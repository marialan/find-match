# TESTSPEC — Find The Two That Match

| | |
|---|---|
| **Title** | Find The Two That Match — Test Specification |
| **Status** | Active — approved verification criteria |
| **Version** | 1.0.0 |
| **Last updated** | 2026-10-21 |
| **Owner/Author** | Maria Lande (with GitHub Copilot) |

This document verifies the product in [PRD.md](PRD.md), system behavior in
[DEVSPEC.md](DEVSPEC.md), and interface in [UISPEC.md](UISPEC.md). Tests must
verify repeated matching as a complete interaction, not merely that a pair
can be matched once. A criterion below is a required check, not a claim
that every criterion is automated.

## 1. Fixtures and tooling

| Fixture | Purpose |
|---|---|
| `test-trials/english/` | Thirteen development trials mirrored by the public English pack |
| English trial 1 | Letter prompts and fixed letter targets |
| English trial 2 | Audio-only prompts paired with letters |
| English trial 3 | Word prompts, four picture targets, and long-word pointer aiming |
| English trials 8 and 13 | Long text and mixed word/image coverage |
| Generated malformed trials | Unknown partner, duplicate ID, non-reciprocal/same-array pair, unequal counts, invalid type/count, and empty playable content |
| Generated repetition trial | Trial requirement of two with one target overridden to four |
| Generated missing-media trial | Absent/broken audio and image fallback |
| Generated non-English pack | Metadata, locale, path isolation, language progress, and packaging discovery |
| Thirteen-entry index | Selector pagination at the 12-tile boundary |
| Bridge mock | Capture completion and summary envelopes |

- Use the existing Node engine/layout/repetition checks through `npm test`.
- Use real browser pointer input for card movement and collision checks;
  a geometry helper test alone is not proof that an edge target is usable.
- Use a browser with touch emulation or a physical touch device for tap drift.
- Cover desktop, 320×568, 360×640, 414×896, 812×375, 568×320, and a square
  viewport. Allow at most 1 CSS px rounding error in geometry assertions.
- Keep fixture/media content local. Temporary fixtures must not modify
  unrelated authored content or delivery artifacts.

## 2. Module verification

### Module 1 — Content loading

- **TC-1.1:** Valid trials retain prompt/target definitions and resolve media
  under the selected language root; optional media may be absent.
- **TC-1.2:** Reject duplicate IDs, missing partners, non-reciprocal pairs,
  multiple/zero partners, same-array pairs, and unequal array counts.
- **TC-1.3:** Default absent `type` to `"letter"` and reject unknown types.
- **TC-1.4:** A valid `trial` parameter selects its file; absent/invalid values
  open the selector.
- **TC-1.5:** Parse indexes ascending and de-duplicated. Missing, malformed,
  empty, or non-positive/non-integer indexes show a content error.
- **TC-1.6:** Verify language metadata and fallback for invalid/unavailable
  language selection. Malformed installed metadata must not silently switch
  languages.
- **TC-1.7:** Reject absolute/cross-language/traversing media paths, including
  encoded traversal and separators, malformed escapes, and URL schemes.
- **TC-1.8:** Verify default three repetitions, trial override, and target
  override precedence. Reject zero, negative, fractional, string, null,
  unsafe, or non-finite counts and prompt-level overrides.
- **TC-1.9:** Empty playable content produces an explicit recoverable error.
  Failed individual media still allows the trial to load.
- **TC-1.10:** Local `file://` loading uses XHR, not `window.fetch()`, and
  loading clears within 10 seconds.

### Module 2 — Responsive placement

- **TC-2.1:** All targets appear in authored order; only one prompt appears
  in the centered tray. Changing `pos` does not change responsive placement.
- **TC-2.2:** Portrait/square uses targets above the prompt; landscape uses
  targets right and prompt left, based on viewport dimensions.
- **TC-2.3:** Assert 12 px outer margins, 16 px inter-region gap, and 60/40
  target/tray allocation after subtracting margins/gap.
- **TC-2.4:** At all supported sizes, assert no page scroll, no resting
  card/indicator overlap, no gap crossing, and no region overflow.
- **TC-2.5:** Images/audio cards remain square; long text widens/wraps and
  stays fully visible. Check both 12-character text and image trials.
- **TC-2.6:** Rotate a partially completed trial. Assert retained counts,
  cancelled active drag, recomputed positions, and correct subsequent hits.

### Module 3 — Drag and collision

- **TC-3.1:** At every pointer move, the entire prompt stays at least 8 px
  inside the board, including long text cards.
- **TC-3.2:** Maintain grab offset and distinguish taps at up to 10 px travel
  from drags beyond 10 px, including final pointer-up movement.
- **TC-3.3:** Verify the rectangle proximity formula with the inclusive
  10 px tolerance and a case immediately outside it.
- **TC-3.4:** If several rectangles qualify, select the target nearest the
  actual pointer, not the clamped prompt center. Exact ties retain authored
  target order. No answer-aware preference is allowed.
- **TC-3.5:** Highlight and release select the same candidate, using the
  final pointer position rather than stale move state.
- **TC-3.6:** In portrait trial 3, reach the long-word prompt, then move it
  over every first-row icon. Assert each pointed-at icon highlights,
  including either edge while the word center is constrained near the middle.
- **TC-3.7:** Cancel a real active pointer gesture, lose capture, and resize.
  Each returns the prompt without incrementing counts or playing success.
- **TC-3.8:** Unrelated pointer IDs cannot move or finish the active gesture.

### Module 4 — Scheduling and equivalence

- **TC-4.1:** Reciprocal prompt/target drops increment only the chosen target
  by one; non-partner and empty drops leave all counts unchanged.
- **TC-4.2:** Schedule unfinished targets by lowest completed count, breaking
  ties by authored prompt order. Equal requirements produce full cycles.
- **TC-4.3:** With unequal target requirements, stop presenting satisfied
  targets and continue the remaining target for its full requirement.
- **TC-4.4:** Complete only at the exact sum of requirements. Counts never
  exceed requirements; targets retain their content and fixed grid positions.
- **TC-4.5:** Verify letters, audio, word/picture, and reciprocal rhyme pairs
  use the same equivalence mechanism.

### Module 5 — Feedback and pronunciation

- **TC-5.1:** Success plays one match tone and one target pronunciation,
  briefly celebrates the target, updates its indicator, and hides the
  consumed prompt during the 480 ms feedback interval.
- **TC-5.2:** Wrong/empty drops play one negative tone, return the same prompt
  to its exact tray center, and retain counts.
- **TC-5.3:** No new gesture is accepted during feedback; the next prompt
  becomes available after feedback without relying on animation-end.
- **TC-5.4:** Initial/replacement prompts float in for 400 ms, including
  consecutive identical prompts. Starting a drag interrupts entry motion.
- **TC-5.5:** Reduced motion disables entry translation and motion-heavy
  match effects while keeping feedback and progression functional.
- **TC-5.6:** The last repetition produces a distinct trial celebration after
  match feedback, with no further prompt. Dismissal changes no counts.
- **TC-5.7:** Loaded recordings play first. Missing/corrupt/absent audio uses
  on-device speech in the learning locale, then tone if no local voice exists.
  Never use a network-backed voice.
- **TC-5.8:** Missing/corrupt images use an interactive neutral placeholder.
  Image cards retain rounded clipping and a transparent card surface.

### Module 6 — Tap and audio-only presentation

- **TC-6.1:** Audio-only cards display a speaker icon, hide their target,
  and use "Play sound" as the accessible name.
- **TC-6.2:** Tap an idle prompt and fixed target; each produces exactly one
  pronunciation without changing counts.
- **TC-6.3:** Small touch drift still counts as a tap. Dragging suppresses the
  subsequent click pronunciation. Keyboard activation can play pronunciation.
- **TC-6.4:** Tap behavior is suppressed during feedback.
- **TC-6.5:** All cards suppress native text selection and tap-highlight.
- **TC-6.6:** Matching audio prompts increments counts and replenishes prompts
  without changing audio-only presentation rules.

### Module 7 — Rich content

- **TC-7.1:** Complete word/picture and rhyme trials through the same repeated
  interaction without text-equality matching.
- **TC-7.2:** At supported portrait and landscape sizes, long-word aiming
  reaches edge targets while the card remains inside the board.
- **TC-7.3:** A long word aimed at a wrong icon highlights that wrong icon
  and rejects on release; it must not automatically select its correct pair.

### Module 8 — Progress

- **TC-8.1:** Persist counts, configuration signature, and completion per
  language and trial. Different languages/trials do not share progress.
- **TC-8.2:** Reload partial counts and resume the correct next prompt without
  replaying feedback or pronunciation.
- **TC-8.3:** Restore completed counts with no prompt, no celebration, and
  no repeated completion events.
- **TC-8.4:** Changed target IDs, pairing, order, or resolved requirements
  invalidate saved counts when the trial is opened.
- **TC-8.5:** Reject malformed progress with a warning; absent counts start
  at zero and restored counts are capped at current requirements.
- **TC-8.6:** Unavailable storage logs a warning but in-memory play continues.
- **TC-8.7:** Reset affects only the current language/trial and clears
  feedback, drag, completion overlay, and saved counts.
- **TC-8.8:** Selector completion reads the saved completion record; opening
  a trial reconciles it against its current configuration.

### Module 9 — Offline and reporting

- **TC-9.1:** Read language/user/trial launch parameters correctly and keep
  the user ID opaque.
- **TC-9.2:** With a mocked bridge, intermediate matches emit no messages.
  The final match emits exactly one completion and one summary envelope.
- **TC-9.3:** Validate envelope keys, `sub_app_id: "findmatch"`, collection
  names, `payload_version`, timestamp, and `layout: "repetition"` data.
  Completion reports target count and required repetition total; summary
  uses `"add"` and `trials_completed: 1`.
- **TC-9.4:** Reloading completion emits nothing. After reset, a new completed
  playthrough emits one new pair of messages.
- **TC-9.5:** Missing or failing bridge must not interrupt browser gameplay.
- **TC-9.6:** Settled media preloads tolerate a deliberately broken asset.
- **TC-9.7:** Full offline play attempts no network calls, uses no Service
  Worker/Cache Storage, and produces no uncaught errors or `NETGUARD_BLOCK`.

### Module 10 — Packaging

- **TC-10.1:** Engine ZIP has root `index.html`, bundle and shared assets,
  with no `lang/` directory.
- **TC-10.2:** Each language ZIP contains only its `lang/<code>/...` paths.
- **TC-10.3:** Engine and language ZIPs extract together without overwrites.
- **TC-10.4:** Built HTML uses one relative deferred non-module script,
  without `type="module"` or `crossorigin`.
- **TC-10.5:** Built and extracted HTML load from `file://` and play offline
  with no missing assets or uncaught errors.
- **TC-10.6:** Generated additional language content is discovered and packaged
  separately; invalid metadata/index/trial/media prevents packaging.

### Module 11 — Selector and navigation

- **TC-11.1:** Thirteen trials produce pages 1–12 and 13, with edge controls
  disabled correctly; twelve or fewer hide pagination.
- **TC-11.2:** Completed trials show green checkmarks and completed accessible
  names; partial/unplayed trials remain neutral.
- **TC-11.3:** Selecting a trial updates the query parameter; back clears it
  where history updates are supported and preserves progress without network
  navigation.
- **TC-11.4:** Back/reset stay available. Next remains hidden until all
  repetitions and final feedback finish; it opens the next indexed trial
  and is absent on the last trial.
- **TC-11.5:** A full 12-tile page fits without page/panel scroll at every
  supported viewport size.

## 3. UI acceptance mapping

Use real or emulated pointer/touch input against the scenarios in
[UISPEC.md](UISPEC.md) §5:

| Scenario | Verification |
|---|---|
| Matching the current prompt | TC-4.1, TC-5.1–5.4 |
| Configurable repetition | TC-1.8, TC-4.2–4.4 |
| A long word can aim at edge targets | TC-3.3–3.6, TC-7.2–7.3 |
| Incorrect or empty drop | TC-4.1, TC-5.2 |
| Cancelling a drag | TC-3.7–3.8 |
| Changing orientation | TC-2.2–2.6 |
| Tap-to-hear with minor movement | TC-3.2, TC-6.2–6.5 |
| Audio-only presentation | TC-6.1, TC-6.6 |
| Completing and restoring a trial | TC-4.4, TC-5.6, TC-8.2–8.3, TC-9.2–9.4 |
| Reduced-motion entry | TC-5.4–5.5 |
| Trial navigation | TC-11.1–11.5 |

Also verify accessible names, focus visibility, polite completion announcement,
and textless loading described by UISPEC §§1–3.

## 4. Offline dry-run protocol

Before release approval:

1. Run the standalone build.
2. Launch built `index.html` from `file://` with
   `?cr_lang=english&cr_user_id=test-user`. Desktop Chrome needs
   `--allow-file-access-from-files` and a throwaway user profile.
3. Set the browser offline before navigation.
4. Confirm selector/board availability within 10 seconds.
5. Complete letters, audio-only, and rich-content trials for their full
   repetition totals, exercising correct/wrong/empty drops, target retention,
   prompt replacement, tap audio, missing-media fallback, and final celebration.
6. Verify no attempted network requests, uncaught errors, or `NETGUARD_BLOCK`
   entries. Required local-file reads are not network I/O.
7. Inspect the bridge messages: one completion and one additive summary per
   completion transition, none on partial progress or reload.
8. Reload partial and completed sessions; verify counts and no replayed events.
9. Verify portrait/landscape geometry, rotation, long-word aiming, and
   containment at the supported sizes.
10. Package engine/language ZIPs into an output location safe to regenerate.
    Extract into a clean directory and repeat this protocol from extracted HTML.

## 5. Build-and-test sequence

1. Run `npm run typecheck` and `npm run lint`.
2. Run `npm test` for engine/data, layout, and repetition checks.
3. Run focused browser acceptance checks for affected behavior.
4. Run `npm run build` and the built-file dry-run.
5. For release verification, run `npm run package`, packaging checks, and
   the extracted-file dry-run.

Documentation-only tasks require a consistency review, not runtime tests:
check requirement references, terminology, metadata/changelog, and absence
of conflicting behavior across the four specifications.

## 6. Acceptance and evidence

- A delivery milestone is verified only when its DEVSPEC exit criteria and
  corresponding UI scenarios pass.
- Record automated results and browser/manual checks separately; do not
  imply helper tests cover full pointer or offline-container behavior.
- Product playtest acceptance does not replace release packaging/offline
  verification or imply publishing authorization.
- English fixtures are development content and must be replaced with
  approved learning content before release.

## Changelog

2026-10-21 — Maria Lande (with GitHub Copilot) — Replaced the document with module-aligned verification of repetition, responsive placement, pointer aiming, persistence, accessibility, and offline delivery.
