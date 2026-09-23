# TESTSPEC — Find The Two That Match

| | |
|---|---|
| **Title** | Find The Two That Match — Test Specification |
| **Status** | Active — pre-implementation |
| **Version** | 1.0.0 |
| **Last updated** | 2026-09-22 |
| **Owner/Author** | Maria Lande (with GitHub Copilot) |

> This TESTSPEC defines **how to verify** the DEVSPEC (behavior) and the UISPEC
> (presentation). Every test case traces to a DEVSPEC requirement id
> (`FR-…` / `NFR-…`) and/or a UISPEC acceptance scenario (§8). It defines the
> test suite a new team must build alongside the product — **no code exists yet**,
> so every case is `AUTO-TARGET` or `MANUAL` until implementation lands (§7).

**Reference chain:** PRD → DEVSPEC → UISPEC → **TESTSPEC**.

---

## 1. Test approach & levels

1. **Static checks.** `npm run typecheck` (strict TS) and `npm run lint` must pass
   on every change. Docs-only changes must not affect them.
2. **Unit tests.** Pure-logic modules are directly testable in node/jsdom with no
   rendering: `matching.ts` (candidate search + equivalence), `coords.ts` (scaling
   + clamping), `content.ts` (schema validation + path resolution), `storage.ts`
   (round-trip + migration), `events.ts` (envelope construction), `reducer.ts`
   (phase transitions and purity). Runner: **Vitest**.
3. **Component / interaction tests.** Render `GameScene` with React Testing
   Library + jsdom and drive **synthetic Pointer Events** (`pointerdown` →
   `pointermove`×n → `pointerup`) to assert phase transitions, highlight state,
   match/reject outcomes, and DOM side effects. The audio module is mocked; the
   bridge is stubbed.
4. **Packaging integrity tests.** `package:container` runs built-in assertions
   (DEVSPEC FR-PKG-03) and fails the build on violation. A separate test extracts
   both ZIPs and asserts the merged tree.
5. **Offline / device QA (manual).** The `file://` smoke test with DevTools
   Network set to Offline, and a playthrough on a 1GB-RAM-class Android device.

**Method tags used below:** `AUTO` (automated, must exist for the milestone that
introduces the requirement), `MANUAL` (scripted human QA).

## 2. Fixtures & test data

- **F-TRIALS-MINI** — 2 trials, 2 pairs each, `kind: "letter"` only. Mirrors the
  real schema (DEVSPEC §I.1.2). The default fixture for engine and interaction
  tests.
- **F-TRIALS-MIXED** — 1 trial containing every `kind`: a letter↔audio pair, a
  word↔picture pair, and a rhyming word↔word pair. Proves cross-kind matching
  against whatever engine is current (DEVSPEC FR-MATCH-02).
- **F-TRIALS-ONEWAY** — a pair where only the **right** object lists the left one
  in `pair_id`. Proves symmetric evaluation (DEVSPEC FR-DATA-05).
- **F-TRIALS-NOPAIR** — a trial containing an object with an empty `pair_id`.
  Proves an empty `pair_id` is accepted; the object may still be matched when
  another object's `pair_id` names it (DEVSPEC FR-DATA-04/05).
- **F-TRIALS-INVALID** — one trial with an out-of-safe-area `pos`, one with a
  duplicate `object_id`, one with a `pair_id` naming a nonexistent object, and one
  valid trial. Proves validation and skip-don't-crash (FR-DATA-01/02/03,
  NFR-ERR-04).
- **F-TRIALS-EN** — the shipped English pack. Used for content validation and
  packaging checks.
- **F-SAVE-CURRENT** — a `Progress` + `TrialState` pair in the current schema.
- **F-SAVE-LEGACY** — a save with no `schemaVersion` and a missing
  `bestErrorsByTrial`, for migration tests (FR-STO-04).
- **F-NO-AUDIO** — the pack with every audio file absent, to force the fallback
  chain (FR-AUD-06).
- **Pointer harness** — a helper that emits a realistic pointer gesture in
  reference-canvas coordinates (press, n moves, release/cancel) so interaction
  tests read as gestures, not as event soup.
- **Bridge stub** — a fake `window.ReactNativeWebView.postMessage` capturing
  posted JSON strings for envelope assertions.
- **Audio spy** — a mock of the audio module recording `playTarget` /
  `playFeedback` calls in order.

## 3. Build-and-test sequence

```bash
# A. Static — must pass on every change
npm run typecheck
npm run lint

# B. Unit + component suites
npm test

# C. Packaging integrity (asserts DEVSPEC FR-PKG-03)
npm run package:container -- --lang english

# D. Upload dry-run — prints the exact CMS plan, contacts nothing
npm run upload -- --lang english --dry-run

# E. Manual QA — offline smoke of the standalone bundle:
#    open dist/standalone/index.html?cr_lang=english&cr_user_id=test from file://
#    with DevTools Network set to Offline; then the device playthrough (§5 G4/G5)
```

## 4. Test cases

Each case: **ID · what it verifies · method · trace**.

### 4.1 Content loading & validation (DEVSPEC §I.1.2)

- **TC-CNT-01** F-TRIALS-EN parses; every trial has a unique `trial_num`, every
  object a unique `object_id` within its trial. `AUTO`. Trace: FR-DATA-01/02.
- **TC-CNT-02** Every authored `pos` is inside the safe area and on the correct
  side of `DIVIDER_X`. `AUTO`. Trace: FR-DATA-03.
- **TC-CNT-03** Every `pair_id` may be empty; when entries are present, each
  entry names an object that exists in the same trial. `AUTO`. Trace:
  FR-DATA-04/05.
- **TC-CNT-04** Every object has an `audio` path; every `picture` object has an
  `image`; every referenced file exists on disk. `AUTO`. Trace: FR-DATA-07/08.
- **TC-CNT-05** No audio or image path in the pack is absolute or a CDN URL; all
  resolve to `./lang/<code>/…` after load-time rewriting. `AUTO`. Trace:
  FR-DATA-07, NFR-OFF-03.
- **TC-CNT-06** F-TRIALS-INVALID: the three malformed trials are skipped with
  warnings and the valid trial still plays; nothing throws. `AUTO`. Trace:
  NFR-ERR-04.
- **TC-CNT-07** An out-of-safe-area `pos` is clamped at runtime rather than
  rendered out of bounds. `AUTO`. Trace: FR-DATA-03.
- **TC-CNT-08** F-TRIALS-NOPAIR: a trial containing an object with an empty
  `pair_id` passes validation and still plays. `AUTO`. Trace: FR-DATA-04.

### 4.2 Matching logic (DEVSPEC §I.4)

- **TC-MATCH-01** Candidate is the **nearest** unmatched, non-self object within
  `TOLERANCE`; null when none qualifies. `AUTO` (pure function, table-driven).
  Trace: FR-DRAG-07, UISPEC §8 "The nearest object wins".
- **TC-MATCH-02** An object exactly at `TOLERANCE` is a candidate; one pixel
  beyond is not. `AUTO`. Trace: FR-DRAG-07.
- **TC-MATCH-03** Already-matched objects are never candidates. `AUTO`. Trace:
  FR-DRAG-07, FR-ENG-05.
- **TC-MATCH-04** F-TRIALS-ONEWAY matches in **both** drag directions. `AUTO`.
  Trace: FR-DATA-05.
- **TC-MATCH-05** F-TRIALS-MIXED: letter↔audio and word↔picture pairs match with
  the same engine used for letter↔letter. `AUTO`. Trace: FR-MATCH-02, UISPEC §8
  "Cross-kind equivalence".
- **TC-MATCH-06** Rhyming word↔word pair matches. `AUTO`. Trace: FR-MATCH-02.
- **TC-MATCH-07** **`kind` is never consulted:** mutating every object's `kind` in
  a fixture changes no match outcome. `AUTO` (property-style). Trace: FR-MATCH-02,
  NFR-CON-06.
- **TC-MATCH-08** A same-side pair (both authored left) matches if the data pairs
  them. `AUTO`. Trace: FR-DRAG-07.

### 4.3 Drag & containment (DEVSPEC §I.4)

- **TC-DRAG-01** Travel above `DRAG_THRESHOLD` starts a drag; release then
  triggers **no** target audio. `AUTO` (component + audio spy). Trace: FR-DRAG-03,
  UISPEC §8 "A drag is never mistaken for a tap".
- **TC-DRAG-02** **M2 onward:** press and release under `TAP_MAX_MS` with travel
  below `DRAG_THRESHOLD` plays the target audio and moves the object **zero** px.
  In M1 the same gesture moves the object zero px and triggers **no** audio.
  `AUTO`. Trace: FR-DRAG-03, FR-AUD-04.
- **TC-DRAG-03** A long press held past `TAP_MAX_MS` without movement, then
  released, is neither a tap nor a match — the object does not move. `AUTO`.
  Trace: FR-DRAG-03.
- **TC-DRAG-04** **Off-screen containment:** pointer moves far beyond each of the
  four edges in turn; the object's full bounds stay inside the safe area every
  frame. `AUTO` + `MANUAL`. Trace: FR-DRAG-04, NFR-CON-03, UISPEC §8.
- **TC-DRAG-05** The dragged object tracks the pointer with the original grab
  offset — it never jumps to centre under the finger. `AUTO`. Trace: FR-DRAG-01.
- **TC-DRAG-06** `originPos` is captured at pick-up; after a reject the object's
  position equals `originPos` exactly. `AUTO`. Trace: FR-DRAG-05, FR-MATCH-04.
- **TC-DRAG-07** A drag survives the pointer leaving the element's bounds
  (pointer capture). `AUTO`. Trace: FR-DRAG-01.
- **TC-DRAG-08** A second concurrent pointer is ignored during a drag; the first
  drag is unaffected. `AUTO`. Trace: FR-DRAG-01, NFR-CON-05.
- **TC-DRAG-09** `pointercancel` mid-drag returns the object silently with no
  error increment. `AUTO`. Trace: FR-MATCH-06, FR-MATCH-05.
- **TC-DRAG-10** `screenToStage()` round-trips: a stage point projected to screen
  and back is stable at several device sizes and aspect ratios. `AUTO`. Trace:
  FR-DRAG-02, UISPEC §1.

### 4.4 Resolution & feedback (DEVSPEC §I.4)

- **TC-RES-01** **Match:** both objects become matched and inert; celebration runs
  `CELEBRATE_MS`; target audio plays; `pair_matched` emits once at the end.
  `AUTO`. Trace: FR-MATCH-03, UISPEC §8.
- **TC-RES-02** **Reject:** `playFeedback('reject')` fires exactly once, the
  object returns to `originPos`, `errors` increments by one, and the candidate
  object's state is byte-identical before and after. `AUTO`. Trace: FR-MATCH-04.
- **TC-RES-03** **No candidate:** the object returns home, **no** reject sound,
  **no** error increment. `AUTO`. Trace: FR-MATCH-05, UISPEC §8.
- **TC-RES-04** No fail state exists: after N consecutive rejects the game is still
  in `present` with every object draggable and no lockout. `AUTO`. Trace:
  NFR-CON-02.
- **TC-RES-05** Highlight and acceptance share one value: a drop at any distance
  that highlighted is never rejected *for distance*. `AUTO` (parameterised sweep
  around `TOLERANCE`). Trace: FR-MATCH-01, NFR (risk table).
- **TC-RES-06** A matched object cannot be dragged; from M2 it still plays audio
  on tap. `AUTO`. Trace: FR-ENG-05, UISPEC §8 "Matched objects".
- **TC-RES-07** `navigator.vibrate` is called with `VIBRATE_MS` on a match where
  available and silently skipped when absent. `AUTO` + `MANUAL`. Trace:
  FR-MATCH-03.

### 4.5 Engine / reducer (DEVSPEC §I.2)

- **TC-ENG-01** Cold load reaches `present` with the resumed trial's objects at
  their authored positions. `AUTO`. Trace: FR-ENG-01/04, UISPEC §5.2.
- **TC-ENG-02** Full cycle for one pair: `present → dragging → resolving →
  present`. `AUTO`. Trace: FR-ENG-02.
- **TC-ENG-03** Matching the final pair enters `trialComplete`, then the next
  trial's `present`. `AUTO`. Trace: FR-ENG-06, UISPEC §5.5.
- **TC-ENG-04** **Reducer purity:** dispatching every action type performs zero
  audio, DOM, storage, or bridge calls (spies assert zero). `AUTO`. Trace:
  FR-ENG-03.
- **TC-ENG-05** Trials play in ascending authored `trial_num` order across a full
  pass — never shuffled. `AUTO`. Trace: FR-ENG-04.
- **TC-ENG-06** A trial completes only when **every** object in it is matched;
  an empty `pair_id` does not by itself make a trial invalid, and an object with
  one can match when another object's `pair_id` names it. `AUTO`. Trace:
  FR-ENG-06, FR-DATA-04/05.
- **TC-ENG-07** After the final trial the game returns to the first with
  `Progress` preserved; no end state is reachable. `AUTO`. Trace: FR-ENG-08,
  UISPEC §8 "The game never dead-ends".

### 4.6 Audio system (DEVSPEC §I.3)

- **TC-AUD-01** With F-TRIALS-EN, `playTarget` decodes and plays the **bundled
  audio file**, not the speech fallback. `AUTO` (mock Web Audio; assert
  `decodeAudioData` + buffer play). Trace: FR-AUD-01.
- **TC-AUD-02** With F-NO-AUDIO, playback degrades to `speechSynthesis` and then a
  silent buffer with **no exception** and no phase hang. `AUTO`. Trace: FR-AUD-06,
  NFR-ERR-02.
- **TC-AUD-03** **M2 onward:** a tap plays the target audio for **every** `kind`,
  including `picture` and `audio`. `AUTO`. Trace: FR-AUD-04.
- **TC-AUD-04** Foley does not interrupt target audio; a new target audio request
  interrupts the previous one. `AUTO`. Trace: FR-AUD-05.
- **TC-AUD-05** Every foley kind (`pickup`, `hover`, `match`, `reject`,
  `trialComplete`) produces output on a mock context without throwing. `AUTO`.
  Trace: FR-AUD-03.
- **TC-AUD-06** `preloadTrial` uses `Promise.allSettled`: one unreadable clip does
  not prevent `loading` from completing. `AUTO`. Trace: FR-AUD-07.
- **TC-AUD-07** The `hover` sound fires **once** on entering candidacy, not
  repeatedly while the drag hovers. `AUTO`. Trace: FR-AUD-03, UISPEC §4.

### 4.7 Storage / persistence (DEVSPEC §I.5)

- **TC-STO-01** Round-trip: `saveProgress` then `getProgress` returns an equal
  `Progress`. `AUTO`. Trace: FR-STO-01.
- **TC-STO-02** Mid-trial reload restores matched ids, `errors`, and `hints`, with
  unmatched objects back at their authored positions. `AUTO`. Trace: FR-ENG-07,
  UISPEC §8 "Resume".
- **TC-STO-03** F-SAVE-LEGACY migrates field-by-field; derivable fields are
  recomputed rather than blind-defaulted. `AUTO`. Trace: FR-STO-04.
- **TC-STO-04** Corrupt/malformed JSON in any key yields safe defaults with no
  throw. `AUTO`. Trace: FR-STO-01, NFR-ERR-05.
- **TC-STO-05** `bestErrorsByTrial` only decreases: a worse second attempt does not
  overwrite a better first. `AUTO`. Trace: FR-STO-03.
- **TC-STO-06** Two languages keep wholly separate `ftm_<lang>_*` records; loading
  one never reads or writes the other's keys. `AUTO`. Trace: FR-STO-05.
- **TC-STO-07** With `localStorage` throwing on every access (quota/private mode),
  the game still plays start to finish. `AUTO`. Trace: FR-STO-01, NFR-ERR-01.
- **TC-STO-08** Kill-and-reopen on a device restores the exact trial and its
  matched pairs. `MANUAL`. Trace: FR-ENG-07.

### 4.8 Event bridge (DEVSPEC §I.6)

- **TC-EVT-01** Outside the container (no bridge) nothing posts and nothing
  throws. `AUTO`. Trace: FR-EVT-04, NFR-ERR-01.
- **TC-EVT-02** With the bridge stub, every emit posts a
  `{type:"cr_event",payload}` **string**; the envelope has exactly the §I.1.4
  fields; `payload_id` is a unique UUID v4 per payload; `options` appears **only**
  for `summary_data`. `AUTO`. Trace: FR-EVT-02.
- **TC-EVT-03** `session_start` fires once at pack load; `pair_matched` once per
  matched pair at the end of the celebration; `trial_completed` once per trial
  with correct `score`/`max_score`/`errors`/`hints_used`/`duration_seconds`;
  `summary_data` rolled up with the right add/replace options. `AUTO`. Trace:
  §I.1.4, FR-EVT-01.
- **TC-EVT-04** `max_score` accompanies every `score`, and equals the number of
  authorable pairs in the trial. `AUTO`. Trace: §I.1.4.
- **TC-EVT-05** `cr_user_id` comes from the launch URL and is `""` when absent;
  the game never generates its own id. `AUTO`. Trace: FR-EVT-03.
- **TC-EVT-06** No event is emitted on pointer move, on a tap, or on a reject;
  envelope size stays far below 64 KB. `AUTO`. Trace: FR-EVT-05.
- **TC-EVT-07** A throwing `postMessage` never propagates into gameplay. `AUTO`.
  Trace: FR-EVT-04.

### 4.9 Packaging & offline (DEVSPEC §I.7, §II.1)

- **TC-PKG-01** Engine ZIP `ftm-core.zip` has `index.html` at its root and
  contains **no** `lang/` directory and no `*.map` files. `AUTO`. Trace: FR-PKG-02.
- **TC-PKG-02** Language ZIP `ftm-lang-<code>.zip` contains **only**
  `lang/<code>/…`, including `ftm.json`. `AUTO`. Trace: FR-PKG-02.
- **TC-PKG-03** Every audio and image path referenced by `ftm.json` is present in
  the language ZIP, and the counts match the source directories. `AUTO`. Trace:
  FR-PKG-03.
- **TC-PKG-04** Extracting both ZIPs into one directory produces **zero**
  overwrites. `AUTO`. Trace: FR-PKG-03.
- **TC-PKG-05** The built bundle contains no `src="/"`, no `url(/…)`, no absolute
  or CDN URL, no `@import`, no `fetch(`, no `navigator.serviceWorker.register`,
  and no `caches.open`. `AUTO` (grep the build output). Trace: NFR-OFF-01/03/05.
- **TC-PKG-06** The tile icon is a **true PNG**, square, ≥192×192, and is not
  inside any ZIP. `AUTO` (magic-byte check). Trace: FR-PKG-04.
- **TC-PKG-07** The upload dry-run prints the correct MCP sequence and arguments
  (`engineSlug:"ftm"`, `hasCoreLevel:false`, the Layout A `urlTemplate`, filenames,
  icon as `iconBase64`) and contacts no server without credentials. `AUTO` +
  `MANUAL` review. Trace: FR-PKG-05.
- **TC-OFF-01** Opening the merged extraction from `file://` with the network
  **offline** loads the game, the bundled font, the trial data, and bundled audio
  within 10 seconds; zero network requests are attempted; the console shows no
  errors. `MANUAL`. Trace: NFR-OFF-01/02, PRD §5.
- **TC-OFF-02** Every loader treats XHR status `0` as success. `AUTO` (mock XHR
  resolving with status 0). Trace: NFR-OFF-02.
- **TC-OFF-03** `cr_lang` selects the pack and defaults to `english` when absent;
  `cr_book` is neither read nor required. `AUTO`. Trace: NFR-OFF-06.
- **TC-OFF-04** Progress persists across a reload of the `file://` bundle.
  `MANUAL`. Trace: NFR-OFF-01, FR-STO-01.

### 4.10 UI / presentation (UISPEC)

- **TC-UI-01** Objects render at their authored centres, correctly cover-scaled at
  several viewport sizes and aspect ratios. `AUTO` + `MANUAL`. Trace: UISPEC §1/§8.
- **TC-UI-02** Both the dragged object and its candidate carry the highlight ring
  simultaneously, and both release together when tolerance is left. `AUTO`. Trace:
  UISPEC §4/§5.3, FR-MATCH-01.
- **TC-UI-03** Exactly two objects are ever highlighted at once. `AUTO`. Trace:
  UISPEC §6.
- **TC-UI-04** The dragged object renders above all others for the whole drag and
  returns to normal stacking on settle. `AUTO`. Trace: FR-DRAG-06, UISPEC §5.3.
- **TC-UI-05** Reject feedback shakes **only** the dragged object; the candidate
  is visually untouched. `AUTO`. Trace: UISPEC §4.
- **TC-UI-06** Each `kind` conveys what §3 of the UISPEC requires: its glyph, the
  whole word, the image, or a non-textual audio mark — and the `audio` kind shows
  no glyphs. `AUTO`. Trace: UISPEC §3.
- **TC-UI-07** A missing image renders the placeholder and the object remains
  draggable, tappable, and matchable. `AUTO`. Trace: NFR-ERR-03, UISPEC §3.3.
- **TC-UI-08** **No instructional text, score, timer, or button**
  anywhere: scan the rendered tree for text nodes and assert every one is an
  object's `target` string. `AUTO`. Trace: NFR-CON-01, UISPEC §2/§6.
- **TC-UI-09** Every interactive object's rendered hit area is ≥ `MIN_TOUCH` on
  both axes at the smallest supported viewport. `AUTO`. Trace: UISPEC §1/§7.
- **TC-UI-10** Matched objects settle **in place** — neither is moved across the
  divider nor removed from the board. `AUTO`. Trace: UISPEC §5.4.
- **TC-UI-11** Trial-complete recap: matched objects pulse left-to-right, each
  replaying its target audio, and the next trial's objects appear before the board
  is empty. `MANUAL` (+ `AUTO` for the audio call order). Trace: UISPEC §5.5.
- **TC-UI-12** Content glyphs and every feedback treatment meet 4.5:1 contrast
  against whatever they sit on. `AUTO` (computed from the implemented palette).
  Trace: UISPEC §2/§7.
- **TC-UI-13** Mouse and pen drive the identical Pointer Events path as touch; no
  interaction requires hover, keyboard, or multi-touch. `AUTO` + `MANUAL`. Trace:
  NFR-CON-05, UISPEC §7.

### 4.11 Performance (DEVSPEC §II.2)

- **TC-PERF-01** Pointer moves are coalesced to one position update per animation
  frame. `AUTO` (fire 10 moves in one frame, assert one update). Trace: NFR-PERF-02.
- **TC-PERF-02** Dragging mutates only `transform`; no layout-triggering property
  and no filter is applied to a moving node. `AUTO` (assert the style keys touched).
  Trace: NFR-PERF-02.
- **TC-PERF-03** Simultaneous particles never exceed `PARTICLE_MAX`. `AUTO`.
  Trace: NFR-PERF-03.
- **TC-PERF-04** 30fps floor while dragging with a celebration running, on a
  1GB-RAM-class Android device. `MANUAL` (profiled). Trace: NFR-PERF-01.
- **TC-PERF-05** The first tap of a trial plays immediately (audio pre-warmed, not
  gated on a decode). `AUTO` + `MANUAL`. Trace: NFR-PERF-04.

## 5. Validation criteria (release gate)

A build is releasable when:

- **G1** `npm run typecheck` and `npm run lint` pass.
- **G2** The full automated suite is green, including every `AUTO` case for the
  milestone being released (§7).
- **G3** All packaging integrity assertions pass (TC-PKG-01..06) and the upload
  dry-run prints a correct plan (TC-PKG-07).
- **G4** The `file://` offline smoke passes (TC-OFF-01) with **bundled audio files**
  playing, zero attempted network requests, and no console errors.
- **G5** A device playthrough on the 1GB-RAM target holds the 30fps floor
  (TC-PERF-04) and survives kill-and-reopen (TC-STO-08).
- **G6** The no-fail and no-chrome invariants hold: TC-RES-02/03/04 and TC-UI-08.
- **G7** Containment holds: no drag can place any part of an object outside the
  safe area (TC-DRAG-04), verified both automatically and by hand on device.

## 6. Coverage matrix (requirement → test case)

| DEVSPEC / UISPEC requirement | Test case(s) |
|---|---|
| FR-DATA-01/02 ids unique | TC-CNT-01 |
| FR-DATA-03 positions in safe area / correct side | TC-CNT-02, TC-CNT-07 |
| FR-DATA-04 empty or multi-entry `pair_id` values | TC-CNT-03, TC-CNT-08, TC-ENG-06 |
| FR-DATA-05 symmetric equivalence | TC-MATCH-04, TC-CNT-03 |
| FR-DATA-06 kinds are presentation only | TC-MATCH-05/06/07, TC-UI-06 |
| FR-DATA-07/08 media paths | TC-CNT-04/05 |
| FR-ENG-01..08 engine | TC-ENG-01..07 |
| FR-AUD-01..07 audio | TC-AUD-01..07, TC-DRAG-02 |
| FR-DRAG-01..07 drag & hit-test | TC-DRAG-01..10, TC-MATCH-01/02/03/08 |
| FR-MATCH-01 highlight parity | TC-RES-05, TC-UI-02/03 |
| FR-MATCH-02 equivalence evaluation | TC-MATCH-04..08 |
| FR-MATCH-03 match feedback | TC-RES-01/07, TC-UI-10 |
| FR-MATCH-04 reject & repel | TC-RES-02, TC-DRAG-06, TC-UI-05 |
| FR-MATCH-05/06 cancelled drag | TC-RES-03, TC-DRAG-09 |
| FR-STO-01..05 storage | TC-STO-01..08 |
| FR-EVT-01..05 event bridge | TC-EVT-01..07 |
| FR-PKG-01..06 packaging | TC-PKG-01..07 |
| NFR-OFF-01..06 offline `file://` | TC-PKG-05, TC-OFF-01..04, TC-AUD-02 |
| NFR-PERF-01..05 performance | TC-PERF-01..05 |
| NFR-ERR-01..05 error handling | TC-CNT-06, TC-STO-04/07, TC-AUD-02/06, TC-UI-07, TC-EVT-07 |
| NFR-CON-01 no instructional text | TC-UI-08 |
| NFR-CON-02 no fail state | TC-RES-02/03/04 |
| NFR-CON-03 nothing leaves the screen | TC-DRAG-04 |
| NFR-CON-05 single-pointer, touch-first | TC-DRAG-08, TC-UI-13 |
| NFR-CON-06 equivalence never inferred | TC-MATCH-07 |
| UISPEC §1 canvas & scaling | TC-UI-01, TC-DRAG-10, TC-UI-09 |
| UISPEC §3 object kinds | TC-UI-06/07 |
| UISPEC §4 feedback states | TC-UI-02/05, TC-RES-01/02, TC-AUD-07 |
| UISPEC §5 phases | TC-ENG-01/02/03/07, TC-UI-10/11 |
| UISPEC §6 visibility rules | TC-UI-03/08, TC-RES-06 |
| UISPEC §7 accessibility & input | TC-UI-09/12/13 |
| UISPEC §8 all Gherkin scenarios | TC-CNT-02, TC-DRAG-01..06, TC-MATCH-01/04/05/06, TC-RES-01/02/03/06, TC-ENG-03/07, TC-STO-02 |

## 7. Current reality vs. target, and per-milestone gates

- **Exists today:** nothing — these four specs precede implementation. Every case
  above is a case **to build**.
- **M1 (MVP) gate:** all of §4.1 (letter-only fixtures), §4.2 (excluding
  TC-MATCH-05/06), §4.3 (TC-DRAG-02 in its M1 form — a tap triggers no audio),
  §4.4, §4.5, §4.6 (excluding TC-AUD-03), §4.7, §4.8, §4.9, §4.10 (excluding
  TC-UI-06/07 for the unshipped kinds), §4.11 — plus gates G1–G7.
- **M2 (Better) gate:** adds tap-to-hear and the `audio` kind — TC-DRAG-02 in its
  M2 form, TC-AUD-03 for every kind, TC-RES-06's tap half, TC-UI-06 for the audio
  mark, and TC-MATCH-05's letter↔audio half.
- **M3 (Great) gate:** adds `word` and `picture` kinds — TC-MATCH-05's
  word↔picture half, TC-MATCH-06, TC-UI-06/07 for pictures, and TC-CNT-04's image
  assertions.
- **Never deferred:** TC-DRAG-04 (containment), TC-RES-04 (no fail state),
  TC-UI-08 (no chrome), TC-OFF-01 (offline smoke). These encode product
  invariants and must pass from the first playable build onward.

---

## Changelog

- 2026-09-22 — GitHub Copilot & Maria Lande — Initial spec authored
