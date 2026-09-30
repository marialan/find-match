# DEVSPEC — Find The Two That Match

|                  |                                                         |
| ---------------- | ------------------------------------------------------- |
| **Title**        | Find The Two That Match — Development Specification     |
| **Status**       | Active — approved behavior                              |
| **Version**      | 0.9.0                                                   |
| **Last updated** | 2026-09-30                                              |
| **Owner/Author** | Maria Lande (with GitHub Copilot)                       |

> This DEVSPEC is derived solely from `docs/Find-The-Two-That-Match-Spec-Brief.md`
> and `docs/third-party-game-spec.md`. It is the source of truth for system
> behavior. It references the PRD for goals but does not duplicate UI screen
> layout, state, or visibility rules — those live in the UISPEC.

---

# Part I — Functional Requirements

## 1. Overview

Find The Two That Match renders a two-column matching board from a trial JSON
file, lets the learner drag objects from one column onto their equivalent
partner in the other column, and gives immediate audio/visual feedback on
match or mismatch. The game must run entirely offline from a `file://` origin
inside the Curious Reader container and must report trial completions through
the container's `cr_event` bridge.

Modules are built in the order listed below; later modules assume earlier ones
are complete.

## 2. Data schema

### 2.1 Trial file

One trial file describes one playable board.

```json
{
  "trial_num": 1,
  "left": [
    {
      "object_id": "left-c-lower",
      "pos": [120, 240],
      "target": "c",
      "pair_id": ["right-c-upper"],
      "image": "images/letter-c-lower.png",
      "audio": "audios/letter-c.mp3"
    }
  ],
  "right": [
    {
      "object_id": "right-c-upper",
      "pos": [640, 240],
      "target": "C",
      "pair_id": ["left-c-lower"],
      "image": "images/letter-c-upper.png",
      "audio": "audios/letter-c.mp3"
    }
  ]
}
```

| Field | Type | Rules |
|---|---|---|
| `trial_num` | number | Unique identifier for the trial; used to select which trial to load |
| `left` / `right` | array of object | Objects rendered on the left/right side of the board |
| `object_id` | string | Unique within the trial; referenced by other objects' `pair_id` |
| `pos` | `[x, y]` number pair | Screen placement of the object at rest |
| `target` | string | The name/value of the object's target concept (letter, word, etc.) |
| `type` | `"letter"` \| `"audio"` | Optional; defaults to `"letter"`. A `"letter"` object displays its `target`; an `"audio"` object is audio-only (Better tier) and never displays its `target`. Any other value makes the trial invalid |
| `pair_id` | string[] | `object_id`s (typically on the opposite side) that are equivalent to this object. May contain more than one id (e.g., a rhyme family) |
| `image` | string (relative path) | Optional; not used by `"audio"` objects. Relative to the trial's language asset root |
| `audio` | string (relative path) | Path to the object's pronunciation audio, relative to the trial's language asset root |

Equivalence rule: two objects A and B are equivalent if `B.object_id` appears
in `A.pair_id` (the relationship is authored bidirectionally by the content
author; the game does not infer the reverse direction).

### 2.2 Media asset paths

All `image`/`audio` paths in trial JSON are relative and resolve under that
trial's language root (`lang/<langCode>/...`), consistent with
`docs/third-party-game-spec.md` §4. No absolute or CDN URLs are permitted in
trial data.

### 2.3 Trial index file

One index file per language pack lists the trials that pack ships. A
`file://` runtime cannot enumerate a directory, so the index is the only
source of truth for which trials exist.

```json
{ "trials": [1, 2, 3] }
```

| Field | Type | Rules |
|---|---|---|
| `trials` | number[] | Non-empty list of positive integers, each the `trial_num` of a `trial-<n>.json` in the same directory. Duplicates are ignored; the list is presented in ascending order |

The index lives at `lang/<langCode>/trials/index.json`. A missing or invalid
index is not a fatal error: the game falls back to the single-trial list
`[1]` so a minimal language pack still plays.

## 3. Modules

### Module 1 — Trial Loader
**Goal:** Load and validate one trial JSON file and resolve its asset paths.

**Tasks:**
- Fetch the trial JSON for the requested `trial_num` using the `file://`-safe
  binary loader pattern (§9.3), never `window.fetch()` for local files.
- Select the trial from the `trial` launch query parameter (positive integer)
  and load `lang/<langCode>/trials/trial-<n>.json`; an absent or invalid value
  shows the Trial Selector screen instead (Module 11).
- Validate required fields (§2.1) are present on every object; reject/report a
  trial that has an object whose `pair_id` references a non-existent
  `object_id`, where an object has no `pair_id` entries at all, or where an
  object's `type` is not an allowed value.
- Resolve every `image`/`audio` path to its full relative location under the
  selected language asset root. The language is read from `cr_lang`; absent or
  unsupported values select the English pack.

**Exit criterion:** Given a well-formed trial file, every object in `left` and
`right` has a resolved, loadable image (if present) and audio path, and every
`pair_id` reference resolves to an existing `object_id` in the same trial.

### Module 2 — Match Board Renderer
**Goal:** Render both columns at their authored positions.

**Tasks:**
- Place every `left` object and every `right` object at its `pos` coordinate.
- Constrain the render area so no object's rest position falls outside the
  playable board.
- The board fills the full width and height of its containing play area
  independently on each axis. Object positions are computed from the authored 
  `pos` coordinates as percentages of the board's current width/height, so they 
  track the stretched board exactly.
- Derive a single object scale factor from the more constrained of the board's
  current width or height ratios (relative to the 1120×650 design space), and
  apply that factor to a consistent card height. Trials containing images use
  a larger card-size ceiling than text-only trials. Text cards widen with the
  rendered target length, up to the available region width; labels may wrap
  within that width. Image cards remain square. Clamp card dimensions to an
  accessible minimum and a sensible maximum so authored spacing is preserved
  and no objects, combined tiles, or cards overlap the region divider at any
  supported board size or aspect ratio.

**Exit criterion:** For every object in a loaded trial, its rendered position
matches its authored `pos` within the tolerance used for hit-testing (Module
3); target text is fully visible; and no two objects' rendered bounds overlap
at any supported viewport size.

### Module 3 — Drag Interaction Engine
**Goal:** Let the learner pick up, move, and release any object without
losing it off-screen.

**Tasks:**
- Support pointer/touch drag on any object.
- Define and apply a single proximity-tolerance value used to detect that a
  dragged object is "over" a candidate partner.
- While a drag is within tolerance of a candidate partner, mark both objects
  as highlighted; when it moves out of tolerance of all candidates, clear the
  highlight.
- Constrain drag movement so the object's on-screen bounds never leave the
  playable board, per the brief's constraint that a child cannot drag an
  object off the screen.
- Record the object's pre-drag position so it can be restored exactly on a
  mismatch.
- Never start a drag on a solved (combined) tile.

**Exit criterion:** Dragging an object to any point on the board keeps it
fully within the visible board bounds at every frame, and releasing it always
resolves to either a highlighted-candidate check (Module 4) or a return to the
untouched, invalid-drop case with no candidate in tolerance (object stays
where released, per MVP scope — see Open Question OQ-3).

### Module 4 — Equivalence Checker
**Goal:** Decide match/no-match when a drag ends within tolerance of a
candidate.

**Tasks:**
- On release, if exactly one candidate object is within tolerance, check
  whether the candidate's `object_id` is present in the dragged object's
  `pair_id` list (§2.1).
- If multiple candidates are simultaneously within tolerance, resolve using
  the nearest candidate by on-screen distance (see Open Question OQ-4).

**Exit criterion:** For every authored equivalent pair in a trial, dragging
one onto the other and releasing always reports a match; dragging one onto
any non-equivalent object and releasing always reports no match.

### Module 5 — Feedback & Celebration
**Goal:** Give immediate, unambiguous feedback for match and mismatch.

**Tasks:**
- On match: mark the pair as solved and merge the two objects into a single
  combined tile at the partner (drop target) object's position. The combined
  tile plays a per-match celebration and the partner's pronunciation plays
  once.
- When the last pair in a trial is solved, play a trial-complete celebration
  that is visually distinct from the per-match celebration.
- Pronunciation audio rule: play the object's `audio` file when one is
  provided and loads; otherwise speak the object's `target` with an
  auto-generated voice in the learning language (`cr_lang`; English only for
  MVP). Only on-device voices are used so speech works offline; if no
  on-device voice for the learning language is available, fall back to a
  synthesized tone. Feedback sounds with no authored audio (e.g., mismatch)
  use synthesized tones.
- Celebrations respect the user's reduced-motion preference.
- On mismatch: play a negative feedback sound and animate the dragged object
  back to the exact pre-drag position recorded by Module 3.

**Exit criterion:** Every match produces exactly one combined tile, one
per-match celebration, and one pronunciation; completing a trial additionally
produces one trial-complete celebration; every mismatch plays exactly one
negative sound and ends with the dragged object's on-screen position equal
(pixel-exact) to its pre-drag position.

### Module 6 — Tap-to-Hear & Audio-Only Objects (Better tier)
**Goal:** Support objects that have no visual glyph and support tap-to-hear on
any object.

**Tasks:**
- Render objects with `type: "audio"` as an audio-only affordance (see UISPEC
  for the visual treatment); their `target` is never displayed.
- On tap (not drag) of any object, play that object's `audio`, following the
  Module 5 pronunciation audio rule. Tapping a combined tile plays the
  partner object's pronunciation.
- Distinguish tap from drag by pointer travel distance, not by the presence of
  pointer-move events: a gesture counts as a drag only once the pointer moves
  farther than a single movement-tolerance value (10 CSS px) from its
  pointer-down point. Touch input emits small move events during an ordinary
  tap, so any non-zero-movement rule silently disables tap-to-hear on
  touchscreens.
- Suppress native touch text-selection and tap-highlight on every object,
  including combined tiles, so a tap never renders a selection highlight.
- Extend Module 4's equivalence check so a letter object and a letter-audio
  object are treated as equivalent purely via the existing `pair_id`
  mechanism — the only schema addition is the optional `type` field.

**Exit criterion:** Every object with `type: "audio"` renders and behaves
identically to an image object for drag, drop, highlight, and equivalence
purposes, differing only in its visual presentation and in supporting
tap-to-hear. Tapping any object — including a combined tile — with mouse or
touch plays exactly one pronunciation and shows no text selection.

### Module 7 — Words, Pictures, and Rhymes (Great tier)
**Goal:** Support object types beyond letters using the same data schema.

**Tasks:**
- Allow `target`/`image`/`audio` to represent a word, a picture, or a rhyming
  word; no schema change beyond what Modules 1–6 already support.
- Confirm equivalence checking (Module 4) already generalizes to word↔picture
  and rhyme↔rhyme pairs, since equivalence is always driven by `pair_id`
  membership, not by object type.

**Exit criterion:** A trial file whose objects are words, pictures, and rhymes
(instead of letters) plays through Modules 2–6 with no code path specific to
letters.

### Module 8 — Progress & Session State
**Goal:** Track which trial/object pairs are solved without scoring pressure
on the learner.

**Tasks:**
- Persist per-trial completion state to `localStorage` (per
  `docs/third-party-game-spec.md` §2.2 — no IndexedDB-backed network-sync
  libraries).
- Persist each played trial's total object count alongside its solved ids, so
  a trial's completion can be derived (solved count equals total count)
  without loading that trial's JSON.
- On reload, restore already-solved pairs as combined tiles without replaying
  any celebration.

**Exit criterion:** Reloading the game mid-trial restores every previously
solved pair as solved and leaves unsolved pairs interactive.

### Module 9 — Container Integration
**Goal:** Comply with the Curious Reader runtime and reporting contract.

**Tasks:**
- Parse `cr_lang`, `cr_user_id`, and `trial` (Module 1) from
  `window.location.search` at boot;
  select the requested language pack and fall back to English when `cr_lang` is
  absent or unsupported.
- Detect `file://` origin at boot and use the XHR-based `loadBinary()` pattern
  (per `docs/third-party-game-spec.md` §2.3) for every local binary asset
  (trial JSON, audio, fonts if any); never call `window.fetch()` or the Cache
  Storage API on a `file://` code path.
- Preload trial assets with `Promise.allSettled`, never `Promise.all`; missing
  pronunciation audio must fall back to the auto-generated voice (Module 5) rather
  than crash playback.
- Emit exactly one `cr_event` (`user_sessions_data`,
  `data.type: "trial_completed"`, including `lang` and the trial's identifying
  data) when every pair in a trial is solved, via
  `window.ReactNativeWebView.postMessage`, guarded so it silently no-ops
  outside the container. Do not emit again for individual pairs or reloads.
- Emit exactly one `summary_data` update for the completed trial's lifetime
  aggregates (such as `trials_completed`) using `"add"` semantics, per
  `docs/third-party-game-spec.md` §6.3.
- Never perform any network I/O anywhere in the codebase.

**Exit criterion:** A full offline play session (per TESTSPEC dry-run
protocol) shows zero network requests, zero `NETGUARD_BLOCK` entries, and one
well-formed `cr_event` per completed trial.

### Module 10 — Packaging
**Goal:** Ship the product as Curious Reader ZIPs.

**Tasks:**
- Build the engine ZIP (`<engine>-core.zip`) containing `index.html` at its
  root, engine JS/CSS, and shared (non-language) assets; no `lang/` directory.
- Build one language ZIP (`<engine>-lang-<langCode>.zip`) per supported
  language containing only `lang/<langCode>/` trial data, images, and audio.
- Use Layout A (engine + lang packs) — the source brief describes no
  language-agnostic shared content unit, so no core/book tier is used.
- Emit the engine bundle as a single classic (non-module) script tag with
  `defer` and a relative `src`. ES module scripts and `crossorigin` are
  CORS-blocked on a `file://` origin (origin `"null"`), which leaves a blank
  page at ship time.

**Exit criterion:** Extracting the engine ZIP plus one language ZIP into a
single directory and opening
`file://…/index.html?cr_lang=<code>&cr_user_id=<id>` plays at least one full
trial offline with no missing assets.

### Module 11 — Trial Selector & Navigation
**Goal:** Let a learner choose any trial in the language pack and move between
trials without editing the URL.

**Tasks:**
- Load the trial index (§2.3) with the `file://`-safe binary loader and show
  the Trial Selector screen at launch when no valid `trial` parameter is
  present; a valid `trial` parameter opens that trial's board directly.
- Paginate the selector at a maximum of 12 trials per page, in ascending
  trial order. Show page navigation only when more than one page exists.
- Mark a trial as completed when its persisted progress (Module 8) shows
  every object in that trial solved.
- From the board, a back control returns to the selector, and a next-trial
  control appears once the trial is complete and a following trial exists in
  the index.
- Keep the selected trial reflected in the `trial` query parameter so a
  reload resumes the same trial, and clear it when returning to the selector.

**Exit criterion:** With an index of more than 12 trials, every trial is
reachable from the selector, completed trials are visibly marked, the board's
back control returns to the selector, and the next-trial control advances to
the next indexed trial only after the current trial is complete.

---

# Part II — Non-Functional Requirements

## 4. Design principles

- No reading is required to operate the game (per PRD goal); all instruction
  is conveyed through visual highlight and audio feedback.
- Drag is forgiving: an incorrect drop never loses or destroys the dragged
  object — it always returns exactly to its pre-drag position.
- The learner is never scored or ranked in a way visible to them.
- Every local-asset load path assumes zero network connectivity from process
  start (per `docs/third-party-game-spec.md` §2.2).

## 5. Error handling

- A malformed trial file (schema violation per §2.1) must be rejected with a
  logged error and must not crash the board renderer for other, valid trials.
- A missing or corrupt audio/image asset must not stop the trial from loading;
  substitute the auto-generated voice (audio, Module 5) and skip rendering (image), per
  `docs/third-party-game-spec.md` §2.3.
- `cr_event` emission failures must never affect gameplay — every emission
  call is wrapped in try/catch and is fire-and-forget.

## 6. Constraints

- **Runtime:** `file://` origin only at ship time; no Service Worker, no
  Cache Storage API, no `window.fetch()` for local assets.
- **Compute:** client-side only, no server-side component.
- **Regulatory/privacy:** no PII is collected or stored; `cr_user_id` is
  treated as opaque and is never combined with any other identifying data.
- **Reporting:** the only permitted outbound channel is the `cr_event`
  `postMessage` bridge; direct analytics SDKs are forbidden
  (`docs/third-party-game-spec.md` §3).

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| A single missing asset freezes the loading screen | Use `Promise.allSettled` for all preloads (Module 9) |
| `window.fetch()` silently fails on Android WebView for `file://` | Use the XHR `loadBinary()` pattern for every local binary (Module 9) |
| A content author authors an object with no equivalent partner | Trial Loader validation rejects/report trials with orphaned `pair_id` references (Module 1) |
| Multiple candidate objects in tolerance range at release | Resolve deterministically by nearest on-screen distance (Module 4); documented as Open Question OQ-4 until confirmed |
| `cr_event` payload exceeds 64 KB | Keep `data` to primitive fields only (trial id, lang, counts); never include full trial JSON in an event |

---

# Part III — Implementation Guide

## 8. Directory structure

Functional tree (by purpose) mapped to an artifact-lifecycle classification:

| Path | Purpose | Lifecycle |
|---|---|---|
| `index.html` | Entry point, ZIP root | Versioned |
| `<engine bundle>.js`, `*.css` | Engine runtime | Versioned |
| `assets/audios/`, `assets/images/` | Shared, non-language assets | Versioned |
| `lang/<langCode>/<trial files>.json` | Per-language trial data | Versioned |
| `lang/<langCode>/audios/`, `lang/<langCode>/images/` | Per-language media | Versioned |
| Build output (`dist/` or equivalent) | Compiled bundle prior to zipping | Ephemeral (regenerate from source in under a minute) |
| ZIP artifacts (`<engine>-core.zip`, `<engine>-lang-<code>.zip`) | Upload artifacts | Ephemeral (regenerate from build output) |
| `localStorage` progress state (device-local, not a repo path) | Learner's in-progress/completed trial state | Durable on-device only; never committed |

## 9. Environment and configuration

- `engineSlug`: agreed with the Curious Learning team at upload time; stable,
  lowercase, hyphenated.
- `sub_app_id`: stable lowercase identifier used in every `cr_event` envelope;
  never changes between releases.
- Build must produce a **standalone** target: bundler public path `./`, no
  `.map` files, no analytics/feature-flag SDK network code.

## 10. Technology stack (rationale deferred to Resolved Decisions once chosen)

- Client-side only, bundled to static assets servable from `file://`.
- Must support: relative-path asset resolution, `FontFace`/`XMLHttpRequest`
  for binary loads, Web Audio or `<audio>` playback, `localStorage`
  persistence.
- Must NOT depend on Service Workers, Cache Storage API, or any network SDK at
  runtime.

## 11. Runbook (from a clean machine)

1. Install project dependencies.
2. Run the standalone build (bundler public path `./`).
3. Open the build output's `index.html` directly via
   `file:///…/index.html?cr_lang=<code>` in a browser with DevTools Network
   set to Offline. Desktop Chrome blocks `XMLHttpRequest` to `file://` by
   default, so launch it with `--allow-file-access-from-files` (and a throwaway
   `--user-data-dir`); the container WebView grants this access itself.
4. Confirm the loading screen clears within 10 seconds and at least one trial
   is fully playable end-to-end.
5. Package the engine ZIP and one language ZIP per §Module 10 and repeat step
   3 against the extracted ZIP contents.

## 12. Deliverables per milestone

| Milestone (PRD §8) | Devspec modules covered |
|---|---|
| M1 — MVP interaction | Modules 1–5, 8, 11 |
| M2 — Better interaction | Module 6 |
| M3 — Great interaction | Module 7 |
| M4 — Container compliance | Modules 9–10 |

---

# Part IV — Appendices

## 13. Open Questions

| ID | Question | Blocks |
|---|---|---|
| OQ-1 | What is the exact proximity-tolerance value (pixels or board-relative units) for drag-over-candidate highlighting? | Module 3, Module 4 |
| OQ-2 | What celebration animation and negative-feedback sound assets are used, and are they shared (`assets/`) or per-language? | Module 5 |
| OQ-3 | When a drag ends with no candidate in tolerance range at all, does the object stay where dropped or return to its pre-drag position? | Module 3 |
| OQ-4 | When a drag ends within tolerance of more than one candidate, is nearest-distance the correct tie-break, or should the first-encountered candidate win? | Module 4 |
| OQ-5 | What technology stack/bundler will be used for the standalone build? | Part III §10 |
| OQ-6 | What is the `engineSlug` / `sub_app_id` to register with the Curious Learning team? | Module 9, Module 10 |

## 14. Resolved Decisions

- `cr_lang` selects the language pack; absent or unsupported values fall back
  to English.
- Better supports audio-only objects, marked with `type: "audio"`, and
  tap-to-hear. Objects without `type` default to `"letter"`. Great supports
  words, pictures, and rhymes through the existing `pair_id` schema.
- The trial to play is chosen on the Trial Selector screen (Module 11), which
  lists the trials named by the language pack's trial index (§2.3), 12 per
  page. The `trial` query parameter still opens one trial directly and is
  kept in sync with the learner's selection (resolves OQ-7).
- Missing/corrupt audio falls back to an offline auto-generated voice in the learning language (tone if no on-device voice); missing/corrupt images use
  a neutral placeholder; `Promise.allSettled` allows loading to continue.
- Each completed trial emits exactly one `trial_completed` event and one
  `summary_data` update.
- Loading is a textless visual state.
- The mobile game shell is contained in the visual viewport with no page-level
  scroll, and object bounds remain inside the board. This containment applies
  whenever either viewport dimension is phone-sized — including a short-height
  landscape orientation with a width above the narrow-portrait breakpoint —
  not only a narrow-width portrait viewport.
- The board scales as a single unit that fills the width and height of its
  containing play area independently on each axis (not letterboxed to the
  authored 1120×650 proportions), while object visual size scales uniformly
  from a single scale factor derived from the more constrained axis, clamped
  to an accessible minimum and a sensible maximum, so objects stay square and
  never overlap each other or the region divider at any supported viewport
  size or board aspect ratio.

## 15. Out of Scope

- Any content-authoring UI inside the game itself (§ PRD Non-goals).
- Any scoring, ranking, or leaderboard feature.
- Any online/CDN-hosted build target (only the offline container target is
  specified by the two source documents).
- Any non-drag input modality.

## 16. Changelog

2026-09-30 — Maria Lande (with GitHub Copilot) — Required the engine bundle to ship as a single relative, deferred, non-module script (ES module scripts are CORS-blocked on `file://`) and documented Chrome's `--allow-file-access-from-files` requirement in the runbook.
2026-09-30 — Maria Lande (with GitHub Copilot) — Defined tap-versus-drag as a 10 px pointer-travel tolerance (rather than the presence of pointer-move events) and required suppression of native touch text-selection and tap-highlight on all objects, so tap-to-hear works on touchscreens.
2026-09-28 — Maria Lande (with GitHub Copilot) — Added the per-language trial index file (§2.3) and Module 11 (Trial Selector & Navigation) with paginated trial selection, persisted trial size for completion marking, back and next-trial navigation, and resolved OQ-7.
2026-09-28 — Maria Lande (with GitHub Copilot) — Defined larger image-trial cards and target-length-aware text widths with wrapping and collision constraints.
2026-09-28 — Maria Lande (with GitHub Copilot) — Added the optional `type` (`letter`/`audio`) object field to mark audio-only objects, made `image` optional for all objects, added `trial` query-parameter trial selection with default 1, and added OQ-7 for a future trial selector screen.
2026-09-28 — Maria Lande (with GitHub Copilot) — Added combined-tile matching with per-match and distinct trial-complete celebrations, non-draggable tap-to-hear solved tiles, reduced-motion support, combined-tile restore on reload, and an authored-audio → offline on-device voice → tone pronunciation fallback in the learning language.
2026-09-23 — Maria Lande (with GitHub Copilot) — Replaced aspect-ratio-preserving (letterboxed) board scaling with independent width/height fill of the play area, and clarified that object size derives from a single scale factor (based on the more constrained axis) so objects remain square without forcing the board's own aspect ratio.
2026-09-23 — Maria Lande (with GitHub Copilot) — Documented aspect-ratio-preserving board scaling and proportional/min-size object footprint (Module 2) to prevent object overlap on narrow viewports, and clarified that mobile containment (Design Principle) applies to short-height landscape orientations too, not only narrow-width portrait viewports.
2026-09-23 — Maria Lande (with GitHub Copilot) — Resolved approved language, tier, asset-fallback, event-count, loading-state, and mobile-containment behavior.
2026-09-23 — Maria Lande (with GitHub Copilot) — Initial draft, derived solely from Find-The-Two-That-Match-Spec-Brief.md and third-party-game-spec.md.

## 17. Lessons Log

_Empty — no implementation has occurred against this draft yet._
