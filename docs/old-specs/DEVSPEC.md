# DEVSPEC — Find The Two That Match

| | |
|---|---|
| **Title** | Find The Two That Match — Development Specification |
| **Status** | Active — pre-implementation |
| **Version** | 1.0.0 |
| **Last updated** | 2026-09-22 |
| **Owner/Author** | Maria Lande (with GitHub Copilot) |

> This DEVSPEC is the **source of truth for behavior**. It realizes the product
> intent defined in the PRD. The UISPEC references this document for behavior;
> the TESTSPEC verifies this document. Where a numeric constant appears here, it
> is authoritative and must match the code and the other specs. Canonical
> constants live in **§I.1.1** and are referenced by id everywhere else.

**Reference chain:** PRD → **DEVSPEC** → UISPEC → TESTSPEC.

---

# Part I — Functional Requirements

## I.0 Overview

Find The Two That Match is a single-page, client-only React application that plays
entirely offline from `file://` inside the Curious Reader WebView. There is no
backend. All content is a bundled **language pack** (JSON + audio); all state is
stored in `localStorage`.

Gameplay is a state machine with six phases:

```
loading → present → dragging → resolving → trialComplete → sessionComplete
             ▲          │           │             │
             └──────────┴───────────┘             │
              (no match / after feedback)         │
             ▲                                    │
             └──────────── next trial ────────────┘
```

- **loading** — read launch params, load the language pack, font, and progress.
- **present** — the trial's objects are seated on their authored sides; the child
  may tap any object to hear it, or begin a drag.
- **dragging** — one object follows the pointer; the nearest eligible drop target
  within `TOLERANCE` is continuously computed and both objects highlight.
- **resolving** — pointer released: equivalence is evaluated and feedback plays
  (celebrate + target audio, or negative sound + repel).
- **trialComplete** — every pair in the trial is matched; a short trial
  celebration plays, then the next trial loads.
- **sessionComplete** — the last authored trial is finished; the game loops back
  to the first trial with progress preserved (there is no end screen and no
  dead end — see FR-ENG-08).

**Requirement ids.** Functional requirements in Part I are cited as `FR-<MODULE>-<n>`
(e.g. `FR-MATCH-03`). The UISPEC and TESTSPEC trace to these ids.

## I.1 Data schema & canonical constants

### I.1.1 Canonical constants (authoritative)

All other specs and all code reference these by id. Changing a value here is a
spec change that must propagate.

| Id | Name | Value | Meaning |
|---|---|---|---|
| `REF_W` | Reference canvas width | `1280` | Authoring space width, in reference px |
| `REF_H` | Reference canvas height | `720` | Authoring space height |
| `SAFE_MARGIN` | Safe edge inset | `64` | Required clearance from every canvas edge for the full interactive object bounds |
| `DIVIDER_X` | Split line | `640` | Visual centre divide between the left and right sides |
| `OBJECT_W` | Object width | `160` | Default object tile width |
| `OBJECT_H` | Object height | `160` | Default object tile height |
| `SAFE_CENTER_X_MIN` | Minimum object centre x | `144` | `SAFE_MARGIN + OBJECT_W / 2`; keeps the full default object inside the safe area |
| `SAFE_CENTER_X_MAX` | Maximum object centre x | `1136` | `REF_W - SAFE_MARGIN - OBJECT_W / 2`; keeps the full default object inside the safe area |
| `SAFE_CENTER_Y_MIN` | Minimum object centre y | `144` | `SAFE_MARGIN + OBJECT_H / 2`; keeps the full default object inside the safe area |
| `SAFE_CENTER_Y_MAX` | Maximum object centre y | `576` | `REF_H - SAFE_MARGIN - OBJECT_H / 2`; keeps the full default object inside the safe area |
| `MIN_TOUCH` | Minimum touch target | `88` | Reference px; no interactive object may render smaller |
| `TOLERANCE` | Match/highlight tolerance | `90` | Centre-to-centre reference px within which a drop target is eligible **and** highlighted. One value serves both — they can never disagree |
| `DRAG_THRESHOLD` | Tap/drag discrimination | `8` | Pointer travel in reference px above which a press becomes a drag |
| `TAP_MAX_MS` | Tap ceiling | `300` | A press released under this duration with travel < `DRAG_THRESHOLD` is a tap |
| `REPEL_MS` | Repel duration | `320` | Time for a rejected object to travel back to its pick-up position |
| `CELEBRATE_MS` | Match celebration | `1600` | Duration of the matched-pair celebration before the objects settle |
| `TRIAL_COMPLETE_MS` | Trial celebration | `2200` | Duration of the all-pairs-matched celebration before the next trial loads |
| `PARTICLE_MAX` | Particle budget | `14` | Maximum simultaneous celebration particles |
| `VIBRATE_MS` | Haptic pulse | `40` | `navigator.vibrate` duration on a successful match, where supported |
| `SUB_APP_ID` | Analytics id | `"ftm"` | Stable `sub_app_id` for `cr_event` |
| `ENGINE_SLUG` | CMS engine slug | `"ftm"` | Reserved engine identity; ZIP filename prefix |

### I.1.2 Language pack (`public/lang/<code>/ftm.json`)

The authoritative content file. It is a superset of the workshop brief's JSON:
every field in the brief is preserved with its original name and meaning; the
added fields (`kind`, `image`, `audio`) carry the media associations the brief
calls for.

```jsonc
{
  "langCode": "english",
  "trials": [
    {
      "trial_num": 1,                 // unique, authored order of play
      "left": [
        {
          "object_id": "c_lower",     // unique within the trial
          "pos": [320, 220],          // [x, y] CENTRE in reference-canvas px
          "target": "c",              // the name of the target (spoken/rendered)
          "pair_id": ["c_upper"],     // object_ids equivalent to this target
          "kind": "letter",           // letter | audio | word | picture
          "image": null,              // relative path, required when kind==="picture"
          "audio": "audios/c.mp3"     // pack-relative; required for every object
        }
      ],
      "right": [
        {
          "object_id": "c_upper",
          "pos": [960, 220],
          "target": "C",
          "pair_id": ["c_lower"],
          "kind": "letter",
          "image": null,
          "audio": "audios/c.mp3"
        }
      ]
    }
  ]
}
```

**Schema rules (validated at load — FR-DATA-01..08):**

- `FR-DATA-01` `trial_num` is unique across the pack; trials play in ascending
  `trial_num` order.
- `FR-DATA-02` `object_id` is unique within a trial (it need not be unique across
  trials).
- `FR-DATA-03` `pos` is the object's **centre** in the reference canvas. Every
  authored object's full bounds must sit inside the safe area: its centre must
  be within `SAFE_CENTER_X_MIN` … `SAFE_CENTER_X_MAX` and
  `SAFE_CENTER_Y_MIN` … `SAFE_CENTER_Y_MAX`. It must also sit inside its own
  side of `DIVIDER_X` (left objects `x < DIVIDER_X`, right objects
  `x > DIVIDER_X`). A violation fails validation loudly in development and is
  **clamped** at runtime in production.
- `FR-DATA-04` `pair_id` may be empty, may name objects on either side, and may
  list more than one id. An empty `pair_id` is valid; an object may still be
  matched when another object's `pair_id` names it, as defined by FR-DATA-05.
- `FR-DATA-05` **Equivalence is symmetric by evaluation, not by authoring.** Two
  objects `A` and `B` match iff `A.pair_id` contains `B.object_id` **or**
  `B.pair_id` contains `A.object_id`. Authors are encouraged but not required to
  write both directions.
- `FR-DATA-06` `kind` is one of `letter`, `audio`, `word`, `picture`.
  `letter` and `word` render their `target` glyphs; `picture` renders `image`;
  `audio` renders a non-textual audio mark and shows
  no glyphs (UISPEC §3.4). `kind` affects presentation only — **equivalence never consults
  `kind`** (FR-MATCH-02), which is what lets a letter match a letter-audio, and a
  word match a picture, with no engine change.
- `FR-DATA-07` `audio` is required for every object of every kind, and is stored
  **relative to the pack directory** (`audios/…`). Paths are rewritten to
  `./lang/<code>/audios/…` at load time so the XHR loader resolves them
  identically in dev and in the offline bundle. Absolute or CDN URLs are invalid.
- `FR-DATA-08` `image` is required when `kind === "picture"`, ignored otherwise,
  and is pack-relative under `images/`.
  If a `picture` asset is missing, unreadable, or fails to load, the object renders
  a neutral placeholder and remains interactive; this is not a fail state and does
  not block the trial.

**Tier coverage.** An MVP (M1) pack uses only `kind: "letter"`. M2 adds
`kind: "audio"`. M3 adds `kind: "word"` and `kind: "picture"`, and expresses
rhymes as two `word` objects that list each other in `pair_id`. **No engine change
is required to move between tiers** — only content and the renderer for the new
`kind`.

### I.1.3 `localStorage` schema

Namespaced per language: keys are `ftm_<lang>_<suffix>`.

- `ftm_<lang>_progress` → `Progress`:
  ```ts
  interface Progress {
    schemaVersion: number;          // current: 1
    currentTrialNum: number;        // trial_num of the trial to resume
    trialsCompleted: number;        // lifetime count, monotonic
    bestErrorsByTrial: Record<string, number>; // `${trial_num}` → fewest incorrect drops
    sessionsStarted: number;
  }
  ```
- `ftm_<lang>_trial_<trial_num>` → `TrialState` — the in-progress trial, so a
  mid-trial reload resumes exactly:
  ```ts
  interface TrialState {
    matched: string[];              // object_ids already matched (both sides)
    errors: number;                 // incorrect drops so far in this trial
    hints: number;                  // audio taps so far in this trial
    startedAt: number;              // epoch ms, for duration reporting
  }
  ```

**Rules.** Every read and write is wrapped so it can never throw (FR-STO-01).
Unknown or missing keys yield safe defaults. A record whose `schemaVersion` is
absent or lower than the current version is **migrated field-by-field, never
blind-defaulted**; unmigratable records are discarded in favour of defaults
rather than crashing (FR-STO-04).

### I.1.4 `cr_event` message contract (container reporting)

All analytics are posted over the WebView bridge as a single JSON string:

```jsonc
{ "type": "cr_event", "payload": { /* envelope */ } }
```

Envelope top-level fields, exactly as the container contract requires:
`payload_id` (fresh UUID v4 per payload), `cr_user_id` (from the launch URL, `""`
if absent), `sub_app_id` (`SUB_APP_ID` = `"ftm"`), `payload_version` (`1`),
`collection` (`"user_sessions_data"` | `"summary_data"`), `timestamp`
(`new Date().toISOString()`), `data`, and — **for `summary_data` only** —
`options` (per-field `"add"`/`"replace"` merge directives; omitted entirely for
`user_sessions_data`).

`user_sessions_data` events (each stamps `type` snake_case + `lang`):

| `data.type` | Fired when | `data` fields |
|---|---|---|
| `session_start` | Language pack loaded successfully | `current_trial_num` |
| `pair_matched` | A correct pair finishes its celebration | `trial_num`, `dragged_id`, `target_id`, `dragged_kind`, `target_kind`, `attempt_index` |
| `trial_completed` | Every pair in a trial is matched | `trial_num`, `score`, `max_score`, `duration_seconds`, `errors`, `hints_used` |

`summary_data` event (rolled up at each `trial_completed`, with merge `options`):
`trials_completed` (add), `pairs_matched` (add), `total_time_played` (add, seconds),
`last_trial_number` (replace).

**Rules.** `score` is the number of pairs matched and `max_score` the number of
authorable pairs in the trial — `max_score` **always** accompanies `score`.
Durations are always **seconds**, never milliseconds, and that unit never changes.
No event is emitted per pointer move or per tap; `pair_matched` is the finest
granularity (FR-EVT-05). Reporting is **fire-and-forget, exception-safe, performs
no network I/O, and is a silent no-op** when `window.ReactNativeWebView?.postMessage`
is absent (plain browser / dev). It is intentionally shipped in the offline build —
it makes no network calls and is the only offline-capable reporting path.

## I.2 Module — Game engine / state reducer

- **Goal:** Drive the whole lifecycle from one deterministic, pure reducer, with
  all side effects (audio, storage, event bridge, animation sequencing) invoked
  imperatively in handlers — never inside the reducer.
- **Tasks:**
  - `FR-ENG-01` A single `useReducer` holds `phase`, `trials`, `currentTrialNum`,
    `objects` (both sides, with live positions), `matched`, `dragging`
    (`{objectId, pointerOffset, originPos}`), `candidateTargetId`, and per-trial
    counters `errors` / `hints`.
  - `FR-ENG-02` Implement the phase transitions of §I.0 through typed actions:
    `LOAD`, `START_TRIAL`, `TAP_OBJECT`, `DRAG_START`, `DRAG_MOVE`, `DRAG_END`,
    `RESOLVE_MATCH`, `RESOLVE_REJECT`, `SETTLE`, `TRIAL_COMPLETE`, `NEXT_TRIAL`.
  - `FR-ENG-03` The reducer is **pure**: it performs no audio, DOM, storage, or
    bridge I/O. Multi-step animations (celebration, repel, trial transition) are
    sequenced with timers in handlers and committed back via actions.
  - `FR-ENG-04` Objects are seated at their authored `pos` on trial start. Trial
    order is the authored ascending `trial_num` order — **never shuffled**, so a
    trial set can teach a deliberate progression.
  - `FR-ENG-05` A matched pair becomes **inert**: it can no longer be dragged, but
    it can still be tapped to replay its audio.
  - `FR-ENG-06` A trial is complete when **every** object in it is matched.
  - `FR-ENG-07` Mid-trial state (matched ids, errors, hints) is persisted on every
    resolution, so a reload restores the same trial mid-progress.
  - `FR-ENG-08` After the final authored trial, the game re-enters trial 1 with
    `Progress` preserved. There is **no end screen, no dead end, and no exit**.
- **Exit criterion:** From a cold load a child can complete every authored trial
  and wrap around to the first; state after each resolution matches §I.1.3; a spy
  on the audio, storage, and event modules records **zero** calls originating
  inside the reducer.

## I.3 Module — Audio system

- **Goal:** Play recorded speech and synthesized feedback entirely offline, with a
  graceful degradation path that can never throw.
- **Tasks:**
  - `FR-AUD-01` Load every clip via **XHR → `decodeAudioData`** into a cached
    `AudioBuffer`; play through a single Web Audio graph. `fetch()` and `<audio>`
    are forbidden (§II.1).
  - `FR-AUD-02` Public API: `playTarget(objectId)` (the object's own `audio`),
    `playFeedback(kind)` for synthesized foley, and `preloadTrial(trialNum)` to
    warm every clip a trial needs before `present` begins.
  - `FR-AUD-03` Foley kinds, all synthesized with oscillators/noise so no files
    are required: `pickup`, `hover`, `match`, `reject`, `trialComplete`.
    `reject` is the brief's "negative feedback sound": short, soft, low — a thud,
    never a buzzer or an error tone (PRD §6 principle "no fail state").
  - `FR-AUD-04` **M2 onward:** a **tap plays the target audio of the tapped
    object**, for every `kind` including `picture` and `audio`. In M1 a tap
    performs no action — the only audio is the match and reject feedback of
    FR-MATCH-03/04.
  - `FR-AUD-05` Target audio is **not interrupted by foley**; a new target audio
    request interrupts the previous target audio.
  - `FR-AUD-06` **Fallback chain:** missing or undecodable clip → `speechSynthesis`
    speaking `target` → a silent 1-frame buffer. No path throws, and no path
    blocks a phase transition.
  - `FR-AUD-07` Preloading uses `Promise.allSettled`; one bad clip never strands
    `loading`.
- **Exit criterion:** In the shipped container, a correct match plays the target
  clip of the matched pair, and (from M2) tapping any object plays its clip;
  deleting every audio file degrades to speech synthesis with no exception and no
  hang.

## I.4 Module — Drag, hit-testing & match resolution

This module owns the brief's four core behaviors: drag, proximity highlight,
equivalence check, and repel.

- **Goal:** Make "carry this one onto that one" reliable, forgiving, and
  impossible to break.
- **Tasks:**
  - `FR-DRAG-01` Pointer handling is **Pointer Events** with pointer capture, so a
    drag survives the finger leaving the object's bounds. One active pointer only;
    additional pointers are ignored for the duration of a drag.
  - `FR-DRAG-02` Screen coordinates convert to reference-canvas coordinates via a
    single `screenToStage()` helper; all game logic works in reference px.
  - `FR-DRAG-03` A press becomes a **drag** once travel exceeds `DRAG_THRESHOLD`;
    a press released under `TAP_MAX_MS` with travel below `DRAG_THRESHOLD` is a
    **tap**, which routes to `playTarget` from M2 and is a no-op in M1
    (FR-AUD-04). These two outcomes are mutually
    exclusive — a gesture never both taps and drags. Taps are ignored during
    `loading`, active celebration, replicate/rebound feedback, and any other
    non-present transition.
  - `FR-DRAG-04` The dragged object's centre is **clamped** each frame to
    `SAFE_CENTER_X_MIN` … `SAFE_CENTER_X_MAX` and
    `SAFE_CENTER_Y_MIN` … `SAFE_CENTER_Y_MAX`, so its full bounds stay inside
    the safe area. This is the brief's hard constraint "a child cannot drag an
    object off the screen", enforced at the position level, not by cancelling
    the drag.
  - `FR-DRAG-05` `originPos` — the object's position at the instant of pick-up —
    is recorded on `DRAG_START` and is the exact position a rejected object
    returns to (the brief's "original location before the finger up event").
  - `FR-DRAG-06` The dragged object renders above all others for the whole drag
    and returns to its normal stacking on settle.
  - `FR-DRAG-07` **Candidate target selection**, recomputed on every pointer move:
    among all objects that are (a) not the dragged object, (b) not already
    matched, and (c) within `TOLERANCE` centre-to-centre of the dragged object's
    current centre — the **nearest** one is the candidate. If none qualifies, the
    candidate is null. If multiple objects are equally close, the candidate is the
    one with the lower `object_id` value. Candidacy is **kind-agnostic and
    side-agnostic**: an object may be dragged in either direction, and onto a
    same-side object, if the data pairs them.
  - `FR-MATCH-01` While a candidate exists, **both** the dragged object and the
    candidate are marked highlighted. The engine exposes this state; the UISPEC
    owns how it looks. Highlight uses the same `TOLERANCE` as acceptance, so the
    child is never highlighted into a drop that is then rejected for distance.
  - `FR-MATCH-02` On pointer up with a candidate, evaluate equivalence by
    `FR-DATA-05` **only**. `kind`, side, and position play no part.
  - `FR-MATCH-03` **Match:** both objects are marked matched and inert
    (FR-ENG-05); the celebration animation runs for `CELEBRATE_MS`; the target
    audio pronouncing the word or letter plays; `navigator.vibrate(VIBRATE_MS)` is
    attempted and silently skipped where unsupported; `pair_matched` is emitted at
    the end of the celebration; mid-trial state persists.
  - `FR-MATCH-04` **No match:** `playFeedback('reject')` plays, the dragged object
    animates back to `originPos` over `REPEL_MS` with an ease-out, `errors`
    increments, and the phase returns to `present`. `errors` is a diagnostic count
    for incorrect drops only; it is not a score, fail state, penalty, or lockout.
    The candidate is untouched and the child may immediately retry. Nothing else
    changes — no score penalty, no lockout, no re-shuffle.
  - `FR-MATCH-05` On pointer up with **no** candidate, the object also returns to
    `originPos` (PRD §7: free placement is out of scope), but this is **not** an
    error and plays no negative sound — it is a cancelled drag.
  - `FR-MATCH-06` Pointer cancellation (`pointercancel`, app backgrounding, a
    second pointer, or an unmount mid-drag) is treated as FR-MATCH-05.
- **Exit criterion:** Every authored pair can be completed by dragging in either
  direction; no drag can place any part of an object outside the safe area; a
  rejected object lands back on its pick-up position to the pixel; highlight and
  acceptance never disagree.

## I.5 Module — Storage / persistence

- **Goal:** Persist and faithfully restore progress on-device, tolerating legacy
  and corrupt save shapes.
- **Tasks:**
  - `FR-STO-01` `getProgress` / `saveProgress` / `resetProgress` and the per-trial
    state helpers, all namespaced `ftm_<lang>_…` and wrapped in try/catch so they
    never throw — including when `localStorage` is unavailable or quota-full.
  - `FR-STO-02` Write points: on every resolution (match or reject), on trial
    completion, and on trial advance.
  - `FR-STO-03` `bestErrorsByTrial` only ever decreases for a given trial (it is a
    personal best, not a last-attempt value).
  - `FR-STO-04` Loading a record with a missing or older `schemaVersion` migrates
    field-by-field against the authoritative data present; a record that cannot be
    migrated is discarded in favour of defaults. Never blind-default a field that
    can be derived from another stored field.
  - `FR-STO-05` Progress is per language: switching `cr_lang` never reads or
    writes another language's keys.
- **Exit criterion:** Killing and reopening the app restores the exact trial, the
  matched objects within it, and the error/hint counters; corrupt JSON in any key
  yields defaults with no exception; a second language keeps a wholly separate
  record.

## I.6 Module — Event bridge (`cr_event`)

- **Goal:** Emit the analytics of §I.1.4 without ever affecting gameplay.
- **Tasks:**
  - `FR-EVT-01` `initEvents(userId, lang)` once at startup; then
    `emitSessionStart`, `emitPairMatched`, `emitTrialCompleted`, `emitSummary`.
  - `FR-EVT-02` Build a spec-exact envelope with a fresh UUID v4 per payload via
    `crypto.randomUUID()` with the dependency-free fallback; include `options`
    **only** for `summary_data`.
  - `FR-EVT-03` `cr_user_id` is read from `window.location.search`; `""` when
    absent. The game never derives, invents, or persists its own user identifier.
  - `FR-EVT-04` Guard on `window.ReactNativeWebView?.postMessage` and wrap every
    emit in try/catch. No batching, queueing, or retrying — the container owns
    offline buffering.
  - `FR-EVT-05` Envelopes stay far below 64 KB and are emitted no more frequently
    than once per matched pair.
- **Exit criterion:** In the container every envelope validates against §I.1.4;
  outside the container nothing is posted and nothing throws.

## I.7 Module — Packaging pipeline

- **Goal:** Produce the exact upload artifacts the Curious Reader CMS expects for
  a **Layout A (2-tier)** title — engine + one language, **no core tier**.
- **Tasks:**
  - `FR-PKG-01` `build:standalone` emits a fully-relative offline bundle
    (`base: './'`) to `dist/standalone/`, with no `.map` files.
  - `FR-PKG-02` `package:container` rebuilds the standalone bundle and emits two
    ZIPs into `dist/container/`:
    - `ftm-core.zip` — **engine tier**, using the container spec's frozen `-core`
      filename token (this project takes no token override). `index.html` at the
      ZIP root, JS/CSS, `assets/` (fonts, shared images, shared audio); **no
      `lang/` directory**, no `*.map`, no non-game web files.
    - `ftm-lang-<code>.zip` — **language tier**: only `lang/<code>/`
      (`ftm.json`, `audios/*`, `images/*`). `--lang` is a parameter.
  - `FR-PKG-03` The packager runs integrity assertions and **fails loudly** on any
    violation: engine ZIP has `index.html` at root and no `lang/`; language ZIP
    contains only its own subtree; every audio and image path referenced by
    `ftm.json` exists in the language ZIP; the two ZIPs merge with zero overwrites.
  - `FR-PKG-04` The tile icon is a true-PNG square (≥192×192, 512×512
    recommended), kept in `upload/` and uploaded **alongside** the language pack —
    never inside a ZIP.
  - `FR-PKG-05` The upload script drives the CMS MCP tools in order:
    `list_engine_slugs` → (first time only) `create_engine_slug` `{slug:"ftm",
    confirmed:true}` → `upload_core_game` (`hasCoreLevel:false`, `title`,
    `urlTemplate: "https://ftm.example.org/?cr_lang={lang}"`) →
    `upload_language_pack` (with `iconBase64`) → `list_inventory`. It **dry-runs**
    unless the server URL and MCP token are present in the environment. ZIPs over
    ~10 MB use `begin_upload` → sequential `upload_chunk` → `uploadId`.
  - `FR-PKG-06` Promotion and publishing are **not** performed by this project's
    tooling (PRD §7); the script stops after upload and prints the remaining
    manual steps.
- **Exit criterion:** `package:container` passes all assertions; extracting both
  ZIPs into one directory and opening `index.html?cr_lang=<code>` from `file://`
  with the network offline plays the game end to end.

---

# Part II — Non-Functional Requirements

## II.1 Offline `file://` constraints (hard)

- `NFR-OFF-01` **No `fetch()`, no `<audio>` element loading, no CDN
  `<script>`/`<link>`/`@import`, no Service Worker, no Cache Storage API.** The
  offline WebView blocks or breaks all of them. **Every** external asset (audio,
  images, JSON, fonts) loads via **XHR `loadBinary`** (`responseType:
  'arraybuffer'`, or `'text'` for JSON).
- `NFR-OFF-02` `file://` XHR returns **status 0 on success** (not 200); every
  loader treats both `200` and `0` as success.
- `NFR-OFF-03` **Relative paths only** in the shipped bundle — no `src="/"`, no
  `url(/…)`, no absolute or CDN URLs anywhere, including inside `ftm.json`.
  `window.location.origin` is never used to build a URL (it is the string
  `"null"`).
- `NFR-OFF-04` **Self-hosted font**, bundled as a local WOFF2 and applied via
  `FontFace` from an ArrayBuffer; the CSS system stack is the fallback.
- `NFR-OFF-05` **No feature-flag, analytics, or error-monitoring SDKs** in the
  bundle — stubbed out at build time, not merely guarded at runtime. The only
  reporting is the `cr_event` bridge, which makes no network calls. The container's
  diagnostic log must show **zero** `NETGUARD_BLOCK` entries.
- `NFR-OFF-06` Launch parameters `cr_lang` and `cr_user_id` are read from
  `window.location.search`. `cr_lang` defaults to `english` when absent. This is a
  Layout A title, so `cr_book` is neither sent nor read.

## II.2 Performance / target device

- `NFR-PERF-01` **30fps floor on 1GB-RAM Android WebViews**, including while
  dragging with a celebration running.
- `NFR-PERF-02` Drag movement updates `transform` only — never layout properties,
  never filters on a moving node. Pointer moves are coalesced to one update per
  animation frame.
- `NFR-PERF-03` Celebration particles are capped at `PARTICLE_MAX`.
- `NFR-PERF-04` `preloadTrial` warms a trial's audio before `present`, so the
  first tap is never gated on a decode.
- `NFR-PERF-05` Nearest-candidate search is a linear scan over the trial's objects
  (authored trials are small, ≤ 12 objects); no spatial index is warranted.

## II.3 Error handling

- `NFR-ERR-01` Every storage and reporting call is wrapped so it can never break
  gameplay.
- `NFR-ERR-02` Missing/undecodable audio degrades per FR-AUD-06 — never an
  exception, never a hang.
- `NFR-ERR-03` A missing picture renders a neutral placeholder tile that is still
  draggable, tappable, and matchable.
- `NFR-ERR-04` A malformed trial (schema violation per §I.1.2) is **skipped** with
  a console warning rather than crashing the pack; if every trial is invalid, the
  loading screen yields to a neutral, textless idle state rather than a blank
  screen or an error page.
- `NFR-ERR-05` The reducer never throws on malformed persisted state; loaders
  default safely.

## II.4 Constraints

- `NFR-CON-01` **No instructional text.** The only glyphs are
  the `target` strings of `letter` and `word` objects (product rule; also removes
  all runtime localization of UI copy).
- `NFR-CON-02` **No fail state.** A wrong drop plays a soft negative sound and
  repels; there is no buzzer, penalty, lockout, or game-over.
- `NFR-CON-03` **No object may leave the screen or become unreachable.**
- `NFR-CON-04` Client-only; no backend, accounts, or network features.
- `NFR-CON-05` Touch-first, single-pointer. Mouse and pen are supported through
  the same Pointer Events path for desktop QA, but no interaction may *require*
  hover, right-click, a keyboard, or multi-touch.
- `NFR-CON-06` Equivalence is authored, never inferred — the engine contains no
  hard-coded knowledge of case pairs, phonics, or rhymes.

## II.5 Risks & mitigations

| Risk | Mitigation |
|---|---|
| Highlight tolerance and acceptance tolerance drift apart, so a highlighted drop gets rejected | A single `TOLERANCE` constant serves both (FR-MATCH-01); TESTSPEC asserts one value drives both. |
| Tap-to-hear and drag fight each other; children can't hear an object without moving it | Explicit `DRAG_THRESHOLD` / `TAP_MAX_MS` discrimination (FR-DRAG-03) with a dedicated test case. |
| An object gets dragged partly off-screen and can't be picked up again | Per-frame clamping of the dragged centre to the safe area (FR-DRAG-04), plus authoring-time position validation (FR-DATA-03). |
| Relative-path breakage between the dev server and `file://` (audio silently falls back to speech) | A single path-resolution step at pack load (FR-DATA-07), `base:'./'` standalone build, and packaging integrity checks that verify every referenced file is in the ZIP. |
| `kind` creeps into the matching logic, blocking letter↔audio and word↔picture matches later | FR-MATCH-02 forbids it; TESTSPEC TC-MATCH-05/06 assert cross-kind matches with the M1 engine. |
| The brief's "leave it anywhere" and the repel rule contradict each other | Resolved: free placement is struck (PRD §7); a no-candidate release returns the object silently (FR-MATCH-05). |
| Low-end device jank while dragging | Transform-only movement, rAF-coalesced pointer moves, particle budget (§II.2). |
| Engine slug reserved wrongly or twice at the CMS | `list_engine_slugs` before `create_engine_slug`; the reservation is permanent and irreversible (FR-PKG-05). |

---

# Part III — Implementation Guide

## III.1 Directory structure & artifact-lifecycle classification

Lifecycle legend: **versioned** = source of truth in git; **ephemeral** = build
output, regenerable, gitignored; **durable** = on-device runtime state.

```
PRD.md / DEVSPEC.md / UISPEC.md / TESTSPEC.md   versioned  — these four specs
Find-The-Two-That-Match-Spec-Brief.md           versioned  — original workshop brief
third-party-game-spec.md                        versioned  — container contract (external)
src/game/
  types.ts        schema + Progress/TrialState types        versioned
  design.ts       the §I.1.1 constants, single source        versioned
  coords.ts       screenToStage, clamping                    versioned
  content.ts      pack load, validation, path resolution     versioned
  matching.ts     candidate search + equivalence             versioned
  audio.ts        XHR load, decode, playback, foley          versioned
  storage.ts      localStorage helpers + migration           versioned
  events.ts       cr_event envelopes + bridge guard          versioned
  reducer.ts      pure state machine                         versioned
src/components/   GameScene, GameObject, Highlight, Celebration, LoadingScreen  versioned
public/lang/<code>/ftm.json                     versioned  — authoritative content
public/lang/<code>/audios/*                     versioned  — target audio (generated placeholders until real recordings land)
public/lang/<code>/images/*                     versioned  — picture-object art (M3)
public/assets/fonts/*.woff2                     versioned  — bundled game font
upload/ftm-icon-512.png                         versioned  — tile icon (uploaded, never zipped)
vite.config.ts / vite.standalone.config.ts      versioned  — dev / offline builds
scripts/package-container.mjs                   versioned  — ZIP packager + assertions
scripts/upload-ftm.ts                           versioned  — CMS MCP uploader (dry-run default)
dist/standalone/                                ephemeral  — offline bundle
dist/container/*.zip                            ephemeral  — upload ZIPs
localStorage ftm_<lang>_*                       durable    — on-device progress
```

## III.2 Tech stack & rationale

- `RD-1` **Web (TypeScript + React + Vite), not React Native.** The workshop brief
  names React Native, but the delivery target is the Curious Reader **WebView**
  container, which loads a web bundle from `file://`. Building web is what makes
  the title shippable through the documented CMS pipeline.
- **TypeScript 5.x, strict.** The data schema is the contract with content
  authors; types enforce it at the boundary.
- **React + Vite** — fast client SPA; two Vite configs (dev, and standalone with
  `base:'./'` for `file://`).
- **No game backend** — the offline constraint and the no-accounts product rule
  make a server unnecessary; state is `localStorage`.
- **Web Audio API** for recorded clips and synthesized foley (works from
  `file://`); **Web Speech API** only as the offline-safe fallback.
- **`FontFace` from an ArrayBuffer** — the only way to load a self-hosted font
  under the `file://` no-CDN constraint.
- **Pointer Events with pointer capture** — one code path for touch, pen, and
  mouse, and the only reliable way to keep a drag alive when the finger outruns
  the element.
- **No physics library.** Movement is direct pointer tracking plus two tweens
  (repel, celebrate); a physics engine would be weight with no gameplay return.

## III.3 Environment / config

- **Language:** selected via the `cr_lang` query param; defaults to `english`.
- **User id:** read from `cr_user_id` in the launch URL; `""` if absent.
- **Dev:** the dev server serves `public/` so `./lang/<code>/…` resolves the same
  way it will from `file://`.
- **Upload secrets (optional):** the CMS server URL and a personal MCP token.
  Absent ⇒ the uploader dry-runs and contacts nothing.

## III.4 Clean-machine runbook

```bash
# 0. Install deps
npm install

# 1. Static checks
npm run typecheck
npm run lint

# 2. Automated tests
npm test

# 3. Run the game in dev
npm run dev          # then open /?cr_lang=english

# 4. Build the offline bundle
npm run build:standalone

# 5. Offline smoke test — open dist/standalone/index.html from file:// with
#    DevTools Network set to Offline:
#    file:///…/dist/standalone/index.html?cr_lang=english&cr_user_id=test

# 6. Build the upload ZIPs (Layout A: engine + language)
npm run package:container -- --lang english
#    → dist/container/ftm-core.zip  +  ftm-lang-english.zip

# 7. Dry-run the CMS upload (no creds needed; prints the exact plan)
npm run upload -- --lang english --dry-run
```

## III.5 Deliverables per milestone

- **M1 (MVP):** Split interface driven by `ftm.json`; `letter` objects; drag with
  off-screen clamping; proximity highlight of both objects; equivalence check on
  release; celebration + spoken target on a match; negative sound + repel to the
  pick-up position on a miss; per-trial and per-language persistence; the
  `cr_event` bridge; build-time placeholder audio for the English pack; the
  standalone build and both upload ZIPs. **A tap does nothing in M1** — the only
  audio is match and reject feedback.
- **M2 (Better):** `kind: "audio"` objects; tap-any-object-to-hear
  surfaced for every kind (FR-AUD-04); letter ↔ letter-audio trials authored and
  shipped in the English pack. **Engine change expected: renderer plus the tap
  route only.**
- **M3 (Great):** `kind: "word"` and `kind: "picture"` objects; word ↔ picture and
  rhyming word ↔ word trials authored; picture assets in the language pack and the
  missing-image placeholder path exercised.

---

# Part IV — Appendices

## IV.1 Open questions

| # | Question | Blocks |
|---|---|---|
| OQ-1 | CMS base URL + personal MCP token from Curious Learning | Live upload / go-live |
| OQ-2 | Confirmation that the engine slug `ftm` is free, then its permanent reservation | First upload |
| OQ-3 | Who supplies the final recorded audio per language, and when it replaces the build-time placeholders | Shipping to production |
| OQ-4 | The visual design direction (UISPEC §2 states constraints only) | Final UI build |
| OQ-5 | Picture art style and licensing for M3 picture objects | M3 content |
| OQ-6 | Confirm the analytics field set against CL's pipeline expectations | Analytics validation |

## IV.2 Resolved decisions (with rationale)

- **2026-09 — Web (React + Vite), not React Native (RD-1).** The deployment target
  is a WebView container that loads a web bundle from `file://`.
- **2026-09 — One `TOLERANCE` for both highlight and acceptance.** Two constants
  would inevitably drift and would teach the child that the highlight lies.
- **2026-09 — Free placement is struck from the brief.** The brief's own text
  strikes "and leave it anywhere"; a no-candidate release returns the object
  silently (FR-MATCH-05), which also guarantees objects stay reachable.
- **2026-09 — Equivalence is evaluated symmetrically (FR-DATA-05).** Requiring
  authors to write both directions is a data-entry trap that produces silent
  one-way bugs.
- **2026-09 — `kind` never participates in matching (FR-MATCH-02).** This is what
  lets M2 (letter ↔ audio) and M3 (word ↔ picture, rhyme) ship as content plus a
  renderer, with no change to the matching engine.
- **2026-09 — Trials play in authored order, never shuffled.** A trial set is a
  deliberate teaching progression.
- **2026-09 — Tap-to-hear stays in M2, as the brief has it.** M1 is a visual
  matching exercise; its only audio is the match pronunciation and the reject
  sound. The tap/drag discrimination (FR-DRAG-03) is still specified in M1 so the
  gesture boundary never has to be retrofitted.
- **2026-09-22 — Empty `pair_id` values are valid (FR-DATA-04).**
  An object may still be matched when another object's `pair_id` names it;
  symmetric evaluation remains authoritative.
- **2026-09 — Target audio is generated at build time as a placeholder** until
  real recordings land. Recorded files remain the runtime contract; speech
  synthesis stays a never-should-fire fallback (FR-AUD-06), so swapping
  placeholders for real recordings is a content change only.
- **2026-09 — The visual design direction is left to implementation.** UISPEC §2
  states only the constraints any direction must satisfy; inventing a palette in
  the spec would have frozen an un-reviewed design as a requirement.
- **2026-09 — Layout A, `hasCoreLevel:false`, frozen `-core` engine filename
  token.** There is no language-independent content unit shared across languages,
  and no reason to request a token override.
- **2026-09 — All binaries load via XHR; `file://` status 0 counts as success.**
  The offline WebView blocks `fetch`, `<audio>` loading, and CDNs.
- **2026-09 — The `cr_event` bridge ships in the standalone build.** It makes no
  network calls and is the only offline-capable reporting path.

## IV.3 Out of scope

See PRD §7. In brief: no backend/accounts, no online features, no in-game
authoring UI, no procedural trial generation, no child-facing score or timer, no
free placement, publishing/promotion is externally gated, and no comprehension,
sentence, or spelling instruction.

## IV.4 Lessons log

*(Populated as the project runs. Each entry: what happened, what it cost, what
rule now prevents it.)*

- *No entries yet — this spec predates implementation.*

## IV.5 Changelog

- 2026-09-22 — GitHub Copilot & Maria Lande — Initial spec authored
