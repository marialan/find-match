# TESTSPEC — Find The Two That Match

|                  |                                                     |
| ---------------- | --------------------------------------------------- |
| **Title**        | Find The Two That Match — Test Specification         |
| **Status**       | Active — approved behavior                          |
| **Version**      | 0.3.0                                               |
| **Last updated** | 2026-09-23                                          |
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
| `trial-audio-only.json` | Includes at least one object with no `image` field (Better tier) — covers Module 6 |
| `trial-mixed-great.json` | Includes word, picture, and rhyme objects (Great tier) — covers Module 7 |
| `trial-missing-asset.json` | References an audio/image path that does not exist on disk — covers DEVSPEC §5 error handling |
| Sample audio/image files under `lang/english/audios/` and `lang/english/images/` matching the fixtures above | Referenced by the fixtures |

## 2. Unit test cases (per DEVSPEC module)

### Module 1 — Trial Loader
- TC-1.1: Loading `trial-letters-basic.json` resolves every object's `image`
  and `audio` to a loadable relative path.
- TC-1.2: Loading `trial-letters-orphan.json` is rejected/reported as invalid
  and does not crash the loader.
- TC-1.3: Loader never calls `window.fetch()` when `window.location.protocol
  === 'file:'` (assert via spy/mock).

### Module 2 — Match Board Renderer
- TC-2.1: Every object in a loaded trial renders at its authored `pos`
  (pixel-exact, within a documented tolerance for coordinate rounding).
- TC-2.2: At a set of supported viewport widths (see UI-TC-8), the board's
  rendered width:height ratio matches its authored 1120:650 design ratio, and
  no two objects' rendered bounding boxes overlap each other or the region
  divider.

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
- TC-5.1: A match triggers exactly one celebration animation start and one
  audio-play call for the target's pronunciation audio.
- TC-5.2: A mismatch triggers exactly one negative-feedback audio-play call
  and the dragged object's final on-screen position equals its recorded
  pre-drag position exactly.

### Module 6 — Tap-to-Hear & Audio-Only Objects (Better tier)
- TC-6.1: An object with no `image` field renders without error and responds
  to drag/highlight/match identically to an image object.
- TC-6.2: A tap (down+up with no intervening move) on any object plays that
  object's `audio` exactly once and produces no state change.
- TC-6.3: A letter object matched against its corresponding letter-audio
  object (via `pair_id`) reports a match (Better-tier equivalence).

### Module 7 — Words, Pictures, and Rhymes (Great tier)
- TC-7.1: Loading `trial-mixed-great.json` renders and plays through Modules
  2–6 with no letter-specific code path invoked.
- TC-7.2: A word object matched against its picture partner (via `pair_id`)
  reports a match.
- TC-7.3: A word object matched against a rhyming-word partner (via
  `pair_id`) reports a match.

### Module 8 — Progress & Session State
- TC-8.1: Completing a pair persists its solved state to `localStorage`.
- TC-8.2: Reloading the page restores every previously solved pair to the
  Solved state and leaves other pairs Idle.

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
  (does not hang), uses silent/no-op audio and a neutral image placeholder,
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
  `trial-audio-only.json`; simulate tap (no movement between down/up).
- UI-TC-6: "Reloading mid-trial preserves solved pairs" — solve one pair,
  reload, assert Solved/Idle states per object.
- UI-TC-7: "Loading screen clears offline within budget" — dry-run protocol,
  §4 below.
- UI-TC-8: "Mobile layout remains contained" — run at the supported mobile
  viewport sizes and assert no page scroll, no object overflow, and no
  object-to-object or object-to-divider overlap (TC-2.2).

## 4. Dry-run protocol (offline verification)

Executed manually (or scripted via a headless browser with network disabled)
before any release candidate is approved:

1. Build the standalone target.
2. Open the built `index.html` via a `file://` URL with
   `?cr_lang=english&cr_user_id=test-user`.
3. Set the browser's network condition to **Offline** before navigation.
4. Confirm the Loading Screen clears within 10 seconds (UI-TC-7).
5. Play through at least one full trial per tier fixture (letters, audio-only,
   mixed) confirming match, mismatch, tap-to-hear, and reload behaviors.
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

2026-09-23 — Maria Lande (with GitHub Copilot) — Added TC-2.2 and extended UI-TC-8/Dry-Run Protocol §4 to verify aspect-ratio-preserving board scaling and absence of object/divider overlap at narrow viewport widths, including short-height landscape sizes.
2026-09-23 — Maria Lande (with GitHub Copilot) — Added verification for approved language fallback, tier asset degradation, exact event counts, textless loading, and mobile containment.
2026-09-23 — Maria Lande (with GitHub Copilot) — Initial draft, derived solely from Find-The-Two-That-Match-Spec-Brief.md and third-party-game-spec.md.
