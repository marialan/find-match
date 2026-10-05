# TESTSPEC — Find The Two That Match

|                  |                                                     |
| ---------------- | --------------------------------------------------- |
| **Title**        | Find The Two That Match — Test Specification         |
| **Status**       | Active — approved behavior                          |
| **Version**      | 0.9.2                                               |
| **Last updated** | 2026-10-05                                          |
| **Owner/Author** | Maria Lande (with GitHub Copilot)                   |

> This TESTSPEC is derived solely from `docs/Find-The-Two-That-Match-Spec-Brief.md`
> and `docs/third-party-game-spec.md`, and verifies the DEVSPEC and UISPEC
> requirements. It supports those documents; it does not redefine behavior.

---

## 1. Fixtures

| Fixture | Purpose |
|---|---|
| `trial-letters-basic.json` | 2 objects per side, lowercase/uppercase letter pairs only (MVP) — covers Module 1–5 |
| `trial-letters-orphan.json` | Contains one object whose `pair_id` references a non-existent `object_id` — negative test for Module 1 validation |
| `trial-audio-only.json` | Includes at least one `type: "audio"` object (Better tier) — covers Module 6. Shipped as `lang/english/trials/trial-2.json` (audio a/m/s left, lowercase letters right) |
| `trial-mixed-great.json` | Includes word, picture, and rhyme objects (Great tier) — covers Module 7 |
| `trial-missing-asset.json` | References an audio/image path that does not exist on disk — covers DEVSPEC §5 error handling |
| Sample audio/image files under `lang/english/audios/` and `lang/english/images/` matching the fixtures above | Referenced by the fixtures |
| `trials-index.json` | Trial index listing the shipped trials (DEVSPEC §2.3). Shipped as `lang/english/trials/index.json` — covers Module 11 |
| `trials-index-13.json` | Index listing 13 trials — pagination test input for Module 11 |

## 2. Unit test cases (per DEVSPEC module)

### Name the World redesign verification
- NW-1: Audio-only and image sides become fixed upper targets regardless of
  whether authored in left or right; the text side becomes lower draggable cards.
- Verify all 13 shipped trials have a text-only draggable side, including the
  approved trial-11 conversion from audio-only objects to written word cards.
- NW-2: Upper targets cannot move. Audio-only crates expose no target text or
  answer image; image targets show their authored asset. Taps show listen feedback.
- NW-3: Correct text drops form fixed vertical combined tiles; mismatches and
  empty drops return exactly to pickup. Restore solved pairs in target slots.
- NW-4: Verify target/card containment and absence of overlaps at 320x568,
  360x640, 414x896, 812x375, 568x320, and desktop; verify long words fit.
- Run typecheck, lint, engine/layout tests, browser pointer/touch acceptance,
  standalone build, packaging, and offline dry-run gates from sections 3-5.
- These cases supersede authored-position, divider, either-side-drag, emoji-crate,
  and horizontal combined-tile assertions for the redesigned screen.

### Module 1 — Trial Loader
- TC-1.1: Loading `trial-letters-basic.json` resolves every object's `image`
  and `audio` to a loadable relative path.
- TC-1.2: Loading `trial-letters-orphan.json` is rejected/reported as invalid
  and does not crash the loader.
- TC-1.3: Loader never calls `window.fetch()` when `window.location.protocol
  === 'file:'` (assert via spy/mock).
- TC-1.4: An object with no `type` loads as `"letter"`; an object with an
  unknown `type` makes the trial invalid.
- TC-1.5: `?trial=2` selects `trial-2.json`; an absent or invalid `trial`
  value selects no trial and the Trial Selector screen is shown instead.
- TC-1.6: A valid trial index parses to an ascending, de-duplicated list of
  trial numbers; an index that is missing, unparsable, empty, or contains a
  non-positive/non-integer entry shows a pack content error. A missing pack
  metadata file falls back to English; malformed metadata does not.
- TC-1.7: A generated, test-only non-English pack verifies metadata validation,
  trial loading, relative media-path resolution, and traversal rejection;
  invalid language codes fall back to English.

### Module 2 — Match Board Renderer
- TC-2.1: Every object in a loaded trial renders at its authored `pos`
  (pixel-exact, within a documented tolerance for coordinate rounding).
- TC-2.2: At a set of supported viewport widths (see UI-TC-8), the board's
  rendered width:height ratio matches its authored 1120:650 design ratio, and
  no two objects' (including combined tiles') rendered bounding boxes overlap
  each other or the region divider.
- TC-2.3: Image-trial cards render larger than the text-only baseline; text
  card width grows with target length, a 12-character target remains fully
  visible, and its combined tile stays within the board and its region at
  desktop, narrow-portrait, and short-landscape viewports.

### Module 3 — Drag Interaction Engine
- TC-3.1: Dragging an object beyond the board's edge clamps its rendered
  position to the board bounds at every simulated pointer-move event.
- TC-3.2: The pre-drag position recorded at drag start equals the object's
  authored `pos` (or its last-solved/rest position after a reload).
- TC-3.3: An object enters the Highlighted state exactly when a candidate
  object is within the tolerance value resolved from DEVSPEC OQ-1, and exits
  it exactly when it leaves that range.

### Module 4 — Equivalence Checker
- TC-4.1: For every pair in `trial-letters-basic.json`, dragging one object
  onto its `pair_id` partner and releasing reports a match.
- TC-4.2: Dragging an object onto any non-`pair_id` object and releasing
  reports no match.
- TC-4.3 (pending OQ-4 resolution): construct a case with two simultaneous
  in-tolerance candidates and assert the documented tie-break rule.

### Module 5 — Feedback & Celebration
- TC-5.1: A match produces exactly one combined tile (the pair's two separate
  objects are no longer rendered), one match-celebration start, and one
  pronunciation play for the partner's audio.
- TC-5.6: In a combined word/image tile, the image is clipped to the rounded
  outer corners of its segment and remains above the play-area decorations.
- TC-5.7: Standalone image cards and image segments in combined cards have no
  colored surface behind the image, while the paired text segment retains its
  side color.
- TC-5.3: Solving the last pair triggers the trial-complete celebration,
  which is distinguishable from the match celebration.
- TC-5.4: Pointer down/move on a combined tile does not start a drag or change
  its position.
- TC-5.5: Under reduced motion, a match still produces the combined tile
  without motion-heavy animation.
- TC-5.2: A mismatch triggers exactly one negative-feedback audio-play call
  and the dragged object's final on-screen position equals its recorded
  pre-drag position exactly.

### Module 6 — Tap-to-Hear & Audio-Only Objects (Better tier)
- TC-6.1: An object with `type: "audio"` renders without error, shows 🔊 and
  not its `target`, and responds to drag/highlight/match identically to a
  letter object.
- TC-6.8: A combined tile for an audio ↔ letter pair shows 🔊 and the letter.
- TC-6.2: A tap (down+up with less than 10 px of pointer travel) on any
  object plays that object's `audio` exactly once and produces no state
  change.
- TC-6.9: A tap whose pointer emits move events but stays within 10 px of the
  down point is still treated as a tap and plays the pronunciation; travel
  beyond 10 px is treated as a drag and plays no tap pronunciation.
- TC-6.10: Every object, including a combined tile, suppresses native touch
  text-selection and tap-highlight (`user-select: none`,
  `-webkit-tap-highlight-color: transparent`).
- TC-6.3: A letter object matched against its corresponding letter-audio
  object (via `pair_id`) reports a match (Better-tier equivalence).
- TC-6.4: Tapping a combined tile plays the partner's pronunciation exactly
  once and produces no state change.
- TC-6.5: An object with a loadable `audio` file plays that file.
- TC-6.6: An object with missing or broken `audio` speaks its `target` with an
  on-device voice in the learning language; network-backed voices are never
  used.
- TC-6.7: With no on-device voice for the learning language (or no speech
  support), the synthesized tone plays instead.
- TC-6.11: The pack's `speechLocale` selects an on-device voice for a
  non-English language when pronunciation audio is unavailable.

### Module 7 — Words, Pictures, and Rhymes (Great tier)
- TC-7.1: Loading `trial-mixed-great.json` renders and plays through Modules
  2–6 with no letter-specific code path invoked.
- TC-7.2: A word object matched against its picture partner (via `pair_id`)
  reports a match.
- TC-7.3: A word object matched against a rhyming-word partner (via
  `pair_id`) reports a match.

### Module 8 — Progress & Session State
- TC-8.1: Completing a pair persists its solved state to `localStorage`.
- TC-8.2: Reloading the page restores every previously solved pair as a
  combined tile with no celebration and leaves other pairs Idle.
- TC-8.3: Playing a trial persists its total object count, so a trial reports
  completed only when its persisted solved count equals that total; resetting
  a trial makes it report not completed again.
- TC-8.4: Two languages with the same trial number retain separate progress;
  existing unscoped English completion records migrate to English only.

### Module 9 — Container Integration
- TC-9.1: Launching with `?cr_lang=english&cr_user_id=abc123` results in the
  game reading both values from `window.location.search`; an absent or
  unsupported `cr_lang` selects English.
- TC-9.2: With `window.ReactNativeWebView.postMessage` mocked, completing a
  trial results in exactly one `cr_event` `postMessage` call and exactly one
  `summary_data` update, with neither repeated per pair or reload. The event
  JSON parses to a valid envelope (`payload_id`, `cr_user_id`, `sub_app_id`,
  `payload_version`, `collection`, `timestamp`, `data`) per
  `docs/third-party-game-spec.md` §6.2.
- TC-9.3: With `window.ReactNativeWebView` undefined (plain browser), no
  `postMessage`-related error is thrown and no attempt is made to call it.
- TC-9.4: Loading `trial-missing-asset.json` completes the loading screen
  (does not hang), uses the auto-generated voice fallback for audio and a neutral image placeholder,
  and the trial still renders every asset that did resolve.
- TC-9.5: A full run using `Promise.allSettled` semantics — one deliberately
  broken asset must not prevent the other assets from loading.
- TC-9.6: The loading state exposes no text and is replaced by the board within
  10 seconds offline.

### Module 10 — Packaging
- TC-10.1: The built engine ZIP contains `index.html` at its root and no
  `lang/` directory.
- TC-10.2: The built language ZIP contains only `lang/<langCode>/...` paths.
- TC-10.3: Extracting the engine ZIP and one language ZIP into a single
  directory produces no overwritten files.
- TC-10.4: The built `index.html` references its bundle with a single
  relative, deferred, non-module `<script>` tag and contains no `type="module"`
  or `crossorigin` attribute.
- TC-10.5: Opening the built `index.html` from a `file://` URL renders the
  Trial Selector and plays a trial, with zero console errors.
- TC-10.6: Packaging discovers language folders (using a temporary
  non-English fixture) and emits separate ZIPs with no cross-language files.
  Invalid metadata, index, references, or missing referenced media prevent packaging.

### Module 11 — Trial Selector & Navigation
- TC-11.1: With 13 indexed trials, page 1 yields trials 1–12 and page 2
  yields trial 13; page count is 2. With 12 or fewer trials, page count is 1.
- TC-11.2: A trial whose persisted progress marks every object solved reports
  completed; a partially solved and an unplayed trial do not.
- TC-11.3: The next trial for a given trial is the next number in the index;
  the last indexed trial has none.
- TC-11.4: Selecting a trial sets the `trial` query parameter and returning to
  the selector clears it, with no network request in either direction.
- TC-11.5: At every viewport size used by UI-TC-8 (including 320×568,
  360×640, 414×896, 812×375, and 568×320), all 12 tiles of a full selector
  page render inside the selector panel with no page-level or panel scroll.

## 3. UI acceptance test cases (per UISPEC Gherkin scenarios)

Each Gherkin scenario in `UISPEC.md` §5 maps to one manual or automated
end-to-end test case, executed against a real or emulated pointer/touch
input:

- UI-TC-1: "Dragging an object onto its equivalent partner" — automate via
  simulated pointer down/move/up events against fixture
  `trial-letters-basic.json`.
- UI-TC-2: "Dragging an object onto a non-equivalent object" — same fixture,
  drag onto a non-partner object.
- UI-TC-3: "Highlighting during drag" — assert Highlighted state toggles at
  the tolerance boundary.
- UI-TC-4: "Dragging never leaves the board" — drag pointer coordinates
  beyond the board's rendered bounding box; assert clamped rendering.
- UI-TC-5: "Tap-to-hear on an audio-only object" — fixture
  `trial-audio-only.json`; simulate tap (no movement between down/up). Also
  covers "Matching an audio-only object to its letter" via `?trial=2`.
- UI-TC-15: "A touch tap with minor finger movement still plays
  pronunciation" — on a real Android device (or touch-emulating browser), tap
  an Idle object and a combined tile; assert pronunciation plays each time and
  no selection highlight appears.
- UI-TC-6: "Reloading mid-trial preserves solved pairs" — solve one pair,
  reload, assert Solved/Idle states per object.
- UI-TC-7: "Loading screen clears offline within budget" — dry-run protocol,
  §4 below.
- UI-TC-8: "Mobile layout remains contained" — run at the supported mobile
  viewport sizes and assert no page scroll, no object overflow, and no
  object-to-object or object-to-divider overlap (TC-2.2).
- UI-TC-9 through UI-TC-12: "A combined tile cannot be dragged", "Tapping a
  combined tile replays its pronunciation", "Completing the trial shows a
  distinct celebration", and "Pronunciation falls back to a generated voice" — same
  fixtures as UI-TC-1.
- UI-TC-13: "Choosing a trial from the selector" and "Paging through more than
  12 trials" — launch with no `trial` parameter; assert at most 12 tiles, the
  numeric page indicator, disabled edge controls, and that tapping a tile opens that
  trial.
- UI-TC-14: "A completed trial is marked in the selector", "Returning to the
  selector from a trial", and "Advancing to the next trial" — complete a
  trial, assert the green checkmark tile, the back control returns to the
  selector with progress intact, and the next-trial control appears only on
  completion and never on the last indexed trial.

## 4. Dry-run protocol (offline verification)

Executed manually (or scripted via a headless browser with network disabled)
before any release candidate is approved:

1. Build the standalone target.
2. Open the built `index.html` via a `file://` URL with
   `?cr_lang=english&cr_user_id=test-user`. In desktop Chrome, launch with
   `--allow-file-access-from-files` and a throwaway `--user-data-dir`, since
   Chrome otherwise blocks `XMLHttpRequest` to `file://`.
3. Set the browser's network condition to **Offline** before navigation.
4. Confirm the Loading Screen clears within 10 seconds (UI-TC-7).
5. Play through at least one full trial per tier fixture (letters, audio-only,
   mixed) confirming match (combined tile + match celebration), trial-complete
   celebration, mismatch, tap-to-hear (including combined tiles), audio file vs.
   generated-voice fallback (while offline), and reload behaviors.
6. Inspect the Network tab: zero requests must appear.
7. Inspect the console: zero uncaught errors (analytics-failure warnings, if
   any, are acceptable per `docs/third-party-game-spec.md` §7b).
8. Confirm progress persists in `localStorage` across a manual reload
   (TC-8.2).
9. Repeat the board check at supported mobile viewport sizes (including
  narrow widths such as 320px, 360px, and 414px, and short-height landscape
  sizes such as 812x375 and 667x320) and confirm no page-level scroll, no
  object overflow, and no object visually overlapping another object or the
  region divider (UI-TC-8, TC-2.2).

## 5. Build-and-test sequence

1. Run static/type checks and unit tests (Modules 1–10 test cases, §2).
2. Run UI/acceptance tests (§3) against a headless or real browser.
3. Build the standalone target and run the dry-run protocol (§4).
4. Build the engine and language ZIPs and run packaging test cases (TC-10.1
   –10.3).
5. Extract the built ZIPs into a clean directory and repeat the dry-run
   protocol (§4) against the extracted `index.html`.

## 6. Validation criteria

A milestone (PRD §8) is considered verified when every DEVSPEC exit criterion
for its covered modules (DEVSPEC §12) passes its corresponding test case(s)
above, every relevant UISPEC Gherkin scenario passes, and the dry-run protocol
(§4) completes with zero network requests and zero uncaught console errors.

## 7. Open items pending DEVSPEC/UISPEC resolution

- TC-3.3, TC-4.3 depend on DEVSPEC OQ-1 and OQ-4 being resolved with concrete
  values before they can be made precise/automatable.
- UI-TC-3 depends on UISPEC UI-OQ-3 (exact highlight treatment) to define a
  visual assertion.

## Changelog
2026-09-30 — Maria Lande (with GitHub Copilot) — Added TC-10.4 and TC-10.5 for the non-module `file://`-loadable build, noted Chrome's `--allow-file-access-from-files` requirement in the dry-run protocol, and renumbered the touch-tap case to UI-TC-15 to remove a duplicate id.
2026-09-30 — Maria Lande (with GitHub Copilot) — Restated TC-6.2 in terms of the 10 px tap tolerance and added TC-6.9, TC-6.10, and UI-TC-14 covering touch taps with minor finger drift and suppression of native selection/tap highlights.
2026-09-28 — Maria Lande (with GitHub Copilot) — Added TC-11.5 verifying that a full page of selector tiles stays visible and scroll-free at every supported viewport size.
2026-09-28 — Maria Lande (with GitHub Copilot) — Added trial-index fixtures and coverage for trial-index parsing and fallback, persisted trial size for completion marking, selector pagination and navigation (TC-1.6, TC-8.3, TC-11.1–11.4, UI-TC-13–14), and updated TC-1.5 for selector-first launch.
2026-09-28 — Maria Lande (with GitHub Copilot) — Added coverage for transparent image surfaces in standalone and combined cards.
2026-09-28 — Maria Lande (with GitHub Copilot) — Added regression coverage for clipped combined-image corners and board/decorative stacking.
2026-09-28 — Maria Lande (with GitHub Copilot) — Added coverage for larger image cards, long target text, and bounded combined-tile layout across viewport sizes.
2026-09-28 — Maria Lande (with GitHub Copilot) — Mapped the audio-only fixture to trial-2 and added verification for object `type` validation, `trial` parameter selection, and audio-only rendering and combined tiles (TC-1.4, TC-1.5, TC-6.1, TC-6.8, UI-TC-5).
2026-09-28 — Maria Lande (with GitHub Copilot) — Added verification for combined tiles, distinct match and trial-complete celebrations, non-draggable solved tiles, reduced motion, combined-tile reload, and the audio file → offline voice → tone fallback (TC-5.3–5.5, TC-6.4–6.7, UI-TC-9–12).
2026-09-23 — Maria Lande (with GitHub Copilot) — Added TC-2.2 and extended UI-TC-8/Dry-Run Protocol §4 to verify aspect-ratio-preserving board scaling and absence of object/divider overlap at narrow viewport widths, including short-height landscape sizes.
2026-09-23 — Maria Lande (with GitHub Copilot) — Added verification for approved language fallback, tier asset degradation, exact event counts, textless loading, and mobile containment.
2026-09-23 — Maria Lande (with GitHub Copilot) — Initial draft, derived solely from Find-The-Two-That-Match-Spec-Brief.md and third-party-game-spec.md.
