# DEVSPEC — Find The Two That Match

|                  |                                                         |
| ---------------- | ------------------------------------------------------- |
| **Title**        | Find The Two That Match — Development Specification     |
| **Status**       | Active — approved behavior                              |
| **Version**      | 0.2.0                                                   |
| **Last updated** | 2026-09-23                                              |
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
| `pair_id` | string[] | `object_id`s (typically on the opposite side) that are equivalent to this object. May contain more than one id (e.g., a rhyme family) |
| `image` | string (relative path) | Optional for audio-only objects (Better tier); required otherwise. Relative to the trial's language asset root |
| `audio` | string (relative path) | Path to the object's pronunciation audio, relative to the trial's language asset root |

Equivalence rule: two objects A and B are equivalent if `B.object_id` appears
in `A.pair_id` (the relationship is authored bidirectionally by the content
author; the game does not infer the reverse direction).

### 2.2 Media asset paths

All `image`/`audio` paths in trial JSON are relative and resolve under that
trial's language root (`lang/<langCode>/...`), consistent with
`docs/third-party-game-spec.md` §4. No absolute or CDN URLs are permitted in
trial data.

## 3. Modules

### Module 1 — Trial Loader
**Goal:** Load and validate one trial JSON file and resolve its asset paths.

**Tasks:**
- Fetch the trial JSON for the requested `trial_num` using the `file://`-safe
  binary loader pattern (§9.3), never `window.fetch()` for local files.
- Validate required fields (§2.1) are present on every object; reject/report a
  trial that has an object whose `pair_id` references a non-existent
  `object_id`, or where an object has no `pair_id` entries at all.
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

**Exit criterion:** For every object in a loaded trial, its rendered position
matches its authored `pos` within the tolerance used for hit-testing (Module
3).

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
- On match: play a celebration animation, play the audio file pronouncing the
  matched target (use the target object's `audio`), and mark the pair as
  solved.
- On mismatch: play a negative feedback sound and animate the dragged object
  back to the exact pre-drag position recorded by Module 3.

**Exit criterion:** Every match plays exactly one celebration + one audio
pronunciation; every mismatch plays exactly one negative sound and ends with
the dragged object's on-screen position equal (pixel-exact) to its pre-drag
position.

### Module 6 — Tap-to-Hear & Audio-Only Objects (Better tier)
**Goal:** Support objects that have no visual glyph and support tap-to-hear on
any object.

**Tasks:**
- Render objects that omit `image` as an audio-only affordance (see UISPEC for
  the visual treatment).
- On tap (not drag) of any object, play that object's `audio`.
- Extend Module 4's equivalence check so a letter object and a letter-audio
  object are treated as equivalent purely via the existing `pair_id`
  mechanism — no schema change is required beyond allowing `image` to be
  omitted.

**Exit criterion:** Every object without an `image` field renders and behaves
identically to an image object for drag, drop, highlight, and equivalence
purposes, differing only in its visual presentation and in supporting
tap-to-hear.

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
- On reload, restore already-solved pairs as solved.

**Exit criterion:** Reloading the game mid-trial restores every previously
solved pair as solved and leaves unsolved pairs interactive.

### Module 9 — Container Integration
**Goal:** Comply with the Curious Reader runtime and reporting contract.

**Tasks:**
- Parse `cr_lang` and `cr_user_id` from `window.location.search` at boot;
  select the requested language pack and fall back to English when `cr_lang` is
  absent or unsupported.
- Detect `file://` origin at boot and use the XHR-based `loadBinary()` pattern
  (per `docs/third-party-game-spec.md` §2.3) for every local binary asset
  (trial JSON, audio, fonts if any); never call `window.fetch()` or the Cache
  Storage API on a `file://` code path.
- Preload trial assets with `Promise.allSettled`, never `Promise.all`; missing
  audio must fall back to a silent buffer rather than crash playback.
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

**Exit criterion:** Extracting the engine ZIP plus one language ZIP into a
single directory and opening
`file://…/index.html?cr_lang=<code>&cr_user_id=<id>` plays at least one full
trial offline with no missing assets.

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
  substitute a silent audio buffer (audio) and skip rendering (image), per
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
   set to Offline.
4. Confirm the loading screen clears within 10 seconds and at least one trial
   is fully playable end-to-end.
5. Package the engine ZIP and one language ZIP per §Module 10 and repeat step
   3 against the extracted ZIP contents.

## 12. Deliverables per milestone

| Milestone (PRD §8) | Devspec modules covered |
|---|---|
| M1 — MVP interaction | Modules 1–5, 8 |
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
- Better supports image-omitted audio-only objects and tap-to-hear. Great
  supports words, pictures, and rhymes through the existing `pair_id` schema.
- Missing/corrupt audio uses silent/no-op playback; missing/corrupt images use
  a neutral placeholder; `Promise.allSettled` allows loading to continue.
- Each completed trial emits exactly one `trial_completed` event and one
  `summary_data` update.
- Loading is a textless visual state.
- The mobile game shell is contained in the visual viewport with no page-level
  scroll, and object bounds remain inside the board.

## 15. Out of Scope

- Any content-authoring UI inside the game itself (§ PRD Non-goals).
- Any scoring, ranking, or leaderboard feature.
- Any online/CDN-hosted build target (only the offline container target is
  specified by the two source documents).
- Any non-drag input modality.

## 16. Changelog

2026-09-23 — Maria Lande (with GitHub Copilot) — Resolved approved language, tier, asset-fallback, event-count, loading-state, and mobile-containment behavior.
2026-09-23 — Maria Lande (with GitHub Copilot) — Initial draft, derived solely from Find-The-Two-That-Match-Spec-Brief.md and third-party-game-spec.md.

## 17. Lessons Log

_Empty — no implementation has occurred against this draft yet._
