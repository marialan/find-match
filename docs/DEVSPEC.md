# DEVSPEC — Find The Two That Match

| | |
|---|---|
| **Title** | Find The Two That Match — Development Specification |
| **Status** | Active — approved behavior |
| **Version** | 1.0.0 |
| **Last updated** | 2026-10-21 |
| **Owner/Author** | Maria Lande (with GitHub Copilot) |

This is the source of truth for system behavior and architecture. Product
goals are in [PRD.md](PRD.md), visual and accessibility requirements in
[UISPEC.md](UISPEC.md), and verification in [TESTSPEC.md](TESTSPEC.md).
Container requirements come from [the third-party game contract](third-party-game-spec.md).

## 1. Overview

The game loads reciprocal prompt/target pairs from a trial JSON file,
renders all targets in a fixed responsive grid, and presents one draggable
prompt at a time. Correct drops increment target repetition counts.
The next prompt appears after feedback, until every required repetition is
complete. Targets are retained, not consumed or merged.

The client is a React/TypeScript application bundled by Vite into static
files for the offline Curious Reader `file://` runtime.

## 2. Data schema

### 2.1 Trial

```json
{
  "trial_num": 1,
  "repetitions": 3,
  "left": [
    {
      "object_id": "prompt-a",
      "pos": [190, 200],
      "target": "a",
      "pair_id": ["target-a"],
      "audio": "audios/a.wav"
    }
  ],
  "right": [
    {
      "object_id": "target-a",
      "pos": [900, 200],
      "target": "A",
      "pair_id": ["prompt-a"],
      "repetitions": 5,
      "audio": "audios/a.wav"
    }
  ]
}
```

| Field | Type | Rules |
|---|---|---|
| `trial_num` | number | Trial identifier matching its indexed `trial-<n>.json` file |
| `left` | object[] | Prompt definitions, in scheduling tie-break order |
| `right` | object[] | Fixed target definitions, in grid order |
| Trial `repetitions` | number, optional | Positive safe integer; default is `DEFAULT_REPETITIONS = 3` |
| `object_id` | string | Unique across both arrays |
| `pos` | `[number, number]` | Required by the content schema; does not determine responsive board placement |
| `target` | string | Letter, word, or concept used for display and pronunciation |
| `type` | `"letter"` or `"audio"`, optional | Defaults to `"letter"`; `"audio"` hides the target and displays a speaker affordance |
| `pair_id` | string[] | Exactly one ID in the opposite array; partner must reference this object's ID in return |
| Target `repetitions` | number, optional | Positive safe integer overriding the trial count; not allowed on `left` objects |
| `image` | string, optional | Pack-relative image path; ignored for audio-only presentation |
| `audio` | string, optional | Pack-relative pronunciation path |

Both arrays must have equal counts and gameplay requires at least one pair.
Invalid pairing, duplicate IDs, unknown types, invalid repetition counts, or
empty playable content must produce an explicit content error.

The required count for target T is:

```text
T.repetitions ?? trial.repetitions ?? DEFAULT_REPETITIONS
```

Equivalence is exclusively reciprocal `pair_id` identity. It applies to
letters, words, pictures, audio, and rhymes. Rhymes must author a specific
partner, not a family of interchangeable candidates.

### 2.2 Language metadata and media

- Each pack has `lang/<code>/pack.json` containing only `code` and
  `speechLocale`. `code` must equal the directory name; `speechLocale` is a
  BCP 47 locale for offline speech.
- Language codes use lowercase letters/digits with optional hyphen-separated
  components, begin with a letter, and have a maximum length of 32.
- UI labels belong to the engine; the engine must not hardcode a language list.
- Media resolves under the selected `lang/<code>/` root. Accept relative paths
  such as `audios/a.wav` and paths already prefixed with that same language root.
- Reject absolute paths, URL schemes, query/fragment components, backslashes,
  encoded separators, malformed escapes, empty path segments, traversal, or
  a reference to another language root.
- Missing or corrupt media uses Module 5 fallbacks; it does not invalidate
  otherwise well-formed runtime trial data.

### 2.3 Trial index

Each pack supplies `lang/<code>/trials/index.json`:

```json
{ "trials": [1, 2, 3] }
```

The list must be non-empty and contain only positive integers. De-duplicate
and sort ascending. Each number names `trial-<n>.json` in that directory.
A local runtime cannot enumerate a directory; this index determines trial
availability. Missing or invalid installed indexes are content errors.

## 3. Modules

### Module 1 — Content loading and validation

- Parse `trial` as a positive integer. An absent or invalid parameter opens
  the selector; a valid parameter requests that trial directly.
- Resolve `cr_lang` to a valid pack. Missing, invalid, or unavailable language
  selection falls back to English. Malformed installed metadata or index
  shows an error instead of substituting another pack.
- Load local JSON and binaries using the `XMLHttpRequest`-based binary loader;
  never use `window.fetch()` for `file://` content.
- Validate schema, reciprocal pairs, repetition counts, metadata, and media
  paths before using the data.
- Preload pronunciation recordings with settled per-asset outcomes so one
  failed asset cannot block other assets.
- Expose textless loading and an explicit error screen with back navigation.
- Ignore asynchronous load results after the board unmounts.

**Exit:** Valid content becomes playable within 10 seconds offline; invalid
content is reported and failed media does not freeze loading.

### Module 2 — Responsive board and card placement

- Use `right` objects as fixed targets and `left` objects as prompts.
- The board fills its containing play area independently on both axes.
  Do not position cards from authored `pos` values.
- Landscape means viewport width greater than height: place the prompt tray
  on the left and target region on the right. Otherwise, place targets
  above the prompt tray.
- Both colored regions have 12 CSS px outer board margins and a 16 CSS px
  gap. After subtracting margins and gap on the split axis, allocate 60%
  to targets and 40% to the tray.
- Arrange targets in a responsive grid in authored target order. Center the
  prompt in its tray. Use a consistent card height fitting both the target
  cells and the tray; image/audio cards are square. Text cards may widen
  within their cell or tray and wrap without clipping.
- Use the available region dimensions to size cards, with a 136 CSS px
  card-height ceiling and space for per-target progress indicators.
- Resting cards and their indicators must not overlap or leave their region
  at supported viewport sizes. The dragged prompt may overlap targets.
- Resizing/rotation recomputes placement and cancels an active gesture without
  changing repetition counts.

**Exit:** Both orientations remain contained and all target concepts remain
visible, including 12-character words, at the supported viewport sizes.

### Module 3 — Pointer interaction and collision

- Only the current prompt can be dragged; targets never move in response
  to a drag. Capture the active pointer and ignore unrelated pointers.
- Record pointer-down location and the grab offset. Movement must exceed
  10 CSS px from pointer-down to count as a drag; minor movement is a tap.
- Dragging interrupts prompt entry motion and follows the pointer using
  the recorded offset.
- Clamp the entire prompt rectangle inside the board with an 8 CSS px
  inset. Do not clamp the pointer used for aiming.
- A target is a collision candidate when:

```text
abs(target.centerX - prompt.centerX) <= (target.width + prompt.width) / 2 + 10
abs(target.centerY - prompt.centerY) <= (target.height + prompt.height) / 2 + 10
```

- Among qualifying targets, choose the target center nearest the current
  finger/mouse pointer, not the clamped prompt center. Exact-distance ties
  retain authored target order. Never prefer a target because it is correct.
- Use the same candidate calculation for highlighting and pointer-up,
  recalculating from the final pointer position.
- Highlight the prompt and the single selected candidate; clear highlighting
  when there is no candidate.
- A long prompt must be able to aim at left, middle, and right targets even
  when containment prevents its center from following the pointer.
- Cancellation, lost pointer capture, and resize restore the prompt to its
  tray without recording a match.

**Exit:** Every target can be aimed at with a wide clamped prompt, while the
card remains visible and highlight/drop agree on the selected target.

### Module 4 — Repetition scheduling and equivalence

- For every target, maintain a non-negative completed-match count capped at
  that target's requirement.
- Present one prompt at a time. Among prompts whose targets are unfinished,
  choose the one with the lowest completed count; use authored `left` order
  to break ties. Equal requirements therefore produce repeated cycles.
- A drop succeeds only when the prompt and selected target reciprocally
  reference each other. Incorrect or empty drops do not change counts.
- Increment only the selected target by one on success.
- Keep targets available and in place after matches, with the prompt and
  target retaining their separate identities.
- Hide the consumed prompt during correct feedback; introduce the next
  eligible prompt when feedback ends.
- Complete the trial only when no unfinished target remains. The required
  total is the sum of resolved target repetition requirements.

**Exit:** Targets with different requirements receive exactly their
configured practice, and wrong drops can never satisfy a requirement.

### Module 5 — Feedback, entry, and pronunciation

- A successful drop plays a match tone, celebrates the selected target, and
  plays its pronunciation once.
- Correct feedback lasts 480 ms before the next prompt is presented. The
  final match then shows a distinct board-level completion celebration.
- A wrong or empty drop plays one negative tone and returns the prompt to
  its tray with brief incorrect-match feedback. Do not accept another drag
  while feedback is active.
- Each newly presented prompt, including initial and repeated identical
  prompts, floats into place over 400 ms. Under reduced motion, show it
  immediately without translation. Drag start interrupts entry animation.
- Match celebrations respect reduced motion; avoid motion-heavy effects.
- Pronunciation uses a loaded local recording first, then on-device speech
  in the pack's `speechLocale`, then a synthesized tone. Never select a
  network-backed voice.
- Failed images render a neutral placeholder and retain interaction.
- Completion overlay dismissal does not change counts or emit events.

**Exit:** Each accepted drop produces one feedback outcome, successful drops
produce one target pronunciation, and progression never depends on an
animation-end event.

### Module 6 — Tap-to-hear and audio-only objects

- Tapping the prompt or a fixed target plays its pronunciation once when no
  drag or feedback is active. Keyboard button activation also plays audio.
- A drag must not additionally trigger tap pronunciation.
- Audio-only objects display a speaker icon, never their `target`, and have
  the accessible name "Play sound".
- Audio-only prompts follow the same scheduling, collision, and matching
  rules as text/image prompts.
- Suppress native touch selection and tap-highlight on all cards.

**Exit:** Minor touch movement remains a tap; audio-only objects work without
revealing the answer or changing counts on a tap.

### Module 7 — Words, pictures, and rhymes

- Use the same pair and repetition schema for every content type.
- Display text when an object has no image and is not audio-only.
- Preserve long-word visibility through responsive width and wrapping.
- Use the same reciprocal equivalence rules for word/picture and rhyme pairs.

**Exit:** Rich-content trials need no letter-specific matching logic, and
wide words can reach edge targets in both orientations.

### Module 8 — Progress and session state

- Store progress in `localStorage` per language and trial:
  `ftm:repetition:lang:<code>:trial:<n>`.
- A stored record contains a `signature`, target-ID `counts`, and `complete`.
- The signature encodes authored target order, each target ID, its prompt
  partner ID, and resolved repetition requirement.
- On load, restore counts only for a matching signature; configuration
  changes start fresh. Missing target counts default to zero; clamp restored
  counts to their current requirements.
- Reject malformed records or negative/non-integer/unsafe counts, log a
  warning, and start with no saved counts. Storage access/write failure
  logs a warning without blocking in-memory gameplay.
- Save initial/restored progress, successful matches, and reset state.
- Reloading restores progress without replaying match or completion feedback,
  pronunciation, or completion events.
- Reset clears the current language/trial counts and transient gesture,
  feedback, and overlay state; it starts a new playthrough.
- Persist completion so the selector can mark played trials without loading
  every trial JSON. On opening a trial, reconcile against its current
  signature and requirements.

**Exit:** Partial and complete sessions survive reload, languages do not
share counts, and reset permits a new playthrough.

### Module 9 — Offline container integration

- Parse `cr_lang`, `cr_user_id`, and `trial` at launch.
- Run from `file://` with zero runtime network I/O, no Service Worker,
  no Cache Storage, and no analytics SDK.
- Guard the Curious Reader bridge so a plain browser remains playable.
- Emit one completion envelope when a successful drop transitions the trial
  to complete, followed by one summary envelope. Emit neither per repetition
  nor on restored completion. Reset permits a new completion transition.
- Completion uses collection `user_sessions_data` with data:
  `type: "trial_completed"`, `trial_num`, `lang`, `layout: "repetition"`,
  `pairs_completed` equal to target count, and `repetitions_completed`
  equal to the required match total.
- Summary uses collection `summary_data` with data:
  `type: "summary_data"`, `operation: "add"`, `trials_completed: 1`,
  and `layout: "repetition"`.
- Both envelopes contain `payload_id`, opaque `cr_user_id`, `sub_app_id:
  "findmatch"`, `payload_version: "1.0"`, collection, timestamp, and data.
- Use fire-and-forget bridge calls; bridge failure must not interrupt play.
  Keep payloads below 64 KB and do not include full trial content or PII.

**Exit:** A complete offline trial produces exactly the two required bridge
messages and zero network requests; reload produces no duplicates.

### Module 10 — Packaging

- Use registered engine slug `findmatch`.
- Produce `findmatch-core.zip` with `index.html` at its root, engine bundle,
  fonts/shared assets, and no `lang/` directory.
- Discover language folders and produce `findmatch-lang-<code>.zip` containing
  only `lang/<code>/...`; packs must not overwrite engine or other pack files.
- Validate metadata, indexes, trial references, and referenced media before
  packaging. Runtime media degradation does not permit shipping broken packs.
- Use relative public path `./` and a single deferred non-module script in
  built HTML, with no `crossorigin` attribute or source maps.
- Adding a language pack must not require rebuilding the engine.

**Exit:** Extracted engine and language ZIPs play together from `file://`
without missing assets, CORS/module failures, or network access.

### Module 11 — Trial selector and navigation

- List the selected pack's indexed trials ascending, at most 12 per page.
- Show previous/next page controls only when more than one page exists,
  disable unavailable directions, and display numeric page position.
- Mark a trial complete using persisted completion from Module 8.
- Selecting a trial updates the `trial` URL parameter where history updates
  are supported; returning to the selector clears it.
- Keep back and reset available. Show next-trial navigation only after final
  feedback ends, completion is true, and a following indexed trial exists.
- Navigation and URL updates must not perform network navigation.

**Exit:** All indexed trials are reachable; completion, page boundaries,
back/reset, and next navigation remain consistent with saved progress.

## 4. Non-functional requirements

- No reading of instructions, competitive grading, or online dependency.
- Keep all resting objects and controls inside the visual viewport.
- Support desktop, narrow portrait, short landscape, and rotation.
- Provide keyboard focus indicators, meaningful accessible names, textless
  loading status, and a polite completion announcement.
- Handle content errors explicitly; degraded assets and unavailable optional
  audio facilities must not prevent gameplay.
- Use client-side computation only; treat container identity as opaque.

## 5. Architecture and files

| Area | Responsibility |
|---|---|
| `src/App.tsx` | Pack/index loading, selected trial, and screen navigation |
| `src/components/RepetitionBoard.tsx` | Board lifecycle, pointer gestures, feedback, and completion transition |
| `src/components/MatchObject.tsx` | Card content, visual states, and audio affordances |
| `src/components/TrialSelector.tsx` | Pagination and completion marking |
| `src/game/repetition.ts` | Region geometry, candidate selection, repetition scheduling, and progress records |
| `src/game/trials.ts` | Trial/index/metadata validation and media resolution |
| `src/game/assets.ts`, `src/game/audio.ts` | Offline binary loading and pronunciation/feedback |
| `src/game/container.ts` | Container event envelopes |
| `public/lang/<code>/` | Pack metadata, trial index, trial JSON, images, and recordings |
| `dist/` | Regenerable standalone build |
| `artifacts/` | Regenerable delivery ZIPs |

## 6. Build and release runbook

1. Install dependencies using the project's package manager.
2. Run typecheck, lint, tests, and standalone build as specified in
   [TESTSPEC.md](TESTSPEC.md).
3. Open built HTML from `file://` offline. Desktop Chrome requires
   `--allow-file-access-from-files` with a throwaway profile; the container
   WebView supplies the required local-file access.
4. Verify a full trial for letters, audio-only, and rich content, plus reload,
   orientation, long-word aiming, and reporting.
5. Build engine/language ZIPs, extract into a clean directory, and repeat the
   offline dry-run. Packaging may recreate its output directory; do not
   overwrite unrelated files.

## 7. Delivery mapping

| Product milestone | Modules |
|---|---|
| M1 — Repeated matching | 1–5, 8, 11 |
| M2 — Audio interaction | 5–6 |
| M3 — Rich content | 3–4, 7 |
| M4 — Container delivery | 9–10 |

## Changelog

2026-10-21 — Maria Lande (with GitHub Copilot) — Replaced the document with integrated requirements for responsive repeated matching, pointer collision, configurable counts, saved progress, and offline delivery.
