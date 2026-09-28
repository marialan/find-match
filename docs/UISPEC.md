# UISPEC — Find The Two That Match

|                  |                                                   |
| ---------------- | ------------------------------------------------- |
| **Title**        | Find The Two That Match — UI Specification         |
| **Status**       | Active — approved behavior                        |
| **Version**      | 0.8.0                                             |
| **Last updated** | 2026-09-28                                        |
| **Owner/Author** | Maria Lande (with GitHub Copilot)                 |

> This UISPEC is derived solely from `docs/Find-The-Two-That-Match-Spec-Brief.md`
> and `docs/third-party-game-spec.md`. It references the DEVSPEC for behavior
> (equivalence rules, tolerance, feedback triggers) and does not duplicate
> that behavior here — only the user-facing surface, states, and acceptance
> criteria are defined below.

---

## 1. Screens

### 1.1 Loading Screen
- Shown from launch until the requested trial's assets have settled
  (successfully or with tolerated per-asset failure — DEVSPEC Module 9).
- Must clear within 10 seconds under offline conditions (PRD §5 KPI).
- Displays no text requiring reading ability (per PRD design goal).

### 1.2 Match Board Screen
- Split into a **left region** and a **right region**.
- Every object from the trial's `left` array renders in the left region at its
  authored `pos`; every object from `right` renders in the right region at its
  authored `pos` (DEVSPEC Module 2).
- Objects render as one of:
  - **Letter object** — `type` absent or `"letter"`; renders its `target`.
  - **Image object** — has an `image`; renders that image.
  - **Audio-only object** (Better tier) — `type: "audio"`; renders a speaker
    emoji (🔊) as an interim icon and never shows its `target`. Its accessible
    name is "Play sound" so it does not reveal the answer.
- If an image is missing or corrupt, the object renders a neutral placeholder
  that remains available for dragging, highlighting, matching, and tap-to-hear.
- Image-containing trials use larger cards. Text cards widen with their target
  text, and long targets wrap within the available region width; image cards
  remain square. Combined cards allocate room for both contents without
  crossing the region divider.
- Image-backed cards and image segments in combined cards have a transparent
  surface; text segments retain their side color.
- The board's usable area never allows an object's rest or dragged position to
  extend past its visible bounds (DEVSPEC Module 3).

### 1.3 Mobile viewport containment
- On mobile viewports, the game shell fits within the visual viewport with no
  page-level horizontal or vertical scrolling.
- "Mobile viewport" includes short-height landscape orientations (e.g. a phone
  turned sideways), not only narrow-width portrait viewports — containment
  must hold whenever either dimension is phone-sized, since a landscape phone
  can be wider than a typical narrow-width breakpoint while still having a
  constrained height.
- The board resizes responsively while preserving both regions and keeps every
  object's rendered bounds inside the board.
- The board fills the full width and height of its containing play area
  independently on each axis. Card height scales uniformly from a single scale
  factor derived from the more constrained axis (width or height). Text-card
  width may grow with target length, bounded by available region space; image
  cards stay square. This keeps authored positions usable without object or
  divider overlap at supported viewport sizes.

### 1.4 Celebrations
Two distinct celebrations exist (DEVSPEC Module 5):
- **Match celebration** — plays on the combined tile when a pair is confirmed
  equivalent. Brief, clearly communicates that the match is correct,
  non-blocking (other unsolved pairs remain interactive), and ends
  automatically.
- **Trial-complete celebration** — a board-level overlay shown after the last
  pair is solved; visually distinct from the match celebration.
- Both respect the user's reduced-motion preference and require no learner
  action to continue.

### 1.5 Trial Selector Screen
- Shown at launch when the launch URL names no valid trial (DEVSPEC Module
  11), and whenever the learner uses the board's back control.
- Lists the language pack's trials (DEVSPEC §2.3) in ascending order as a grid
  of tiles, each labelled with its trial number.
- Shows a maximum of **12 tiles per page**. When more trials exist, a bottom
  navigation row shows a previous-page control, the current page position
  ("Page X of Y"), and a next-page control; the control for a non-existent
  page is disabled. With 12 or fewer trials, no page navigation is shown.
- A **completed** trial tile (all its pairs solved, DEVSPEC Module 8) is shown
  in green with a checkmark; its accessible name states that it is completed.
  An uncompleted tile uses the neutral tile treatment.
- Selecting a tile opens that trial's Match Board Screen.

### 1.6 Board navigation controls
- The Match Board Screen shows a **back control** (return-arrow icon) that
  returns to the Trial Selector Screen. It is available at all times, has the
  accessible name "Back to trial selector", and discards no progress.
- The board shows a **next-trial control** (forward-arrow icon) only once the
  current trial is complete and a following trial exists in the index. It
  opens that next trial.
- Both controls sit in the board footer alongside the existing reset control
  and are icon-only, consistent with the textless design goal.

## 2. States

| State | Entry condition | Visible characteristics |
|---|---|---|
| **Idle** | Object at rest, not being dragged, not highlighted | Rendered at its authored `pos` |
| **Dragging** | Learner has an active pointer/touch drag on the object | Object follows pointer; constrained within board bounds |
| **Highlighted** | A dragged object is within tolerance of a candidate partner (or vice versa) | Both the dragged object and the candidate show a highlight treatment (exact visual: Open Question UI-OQ-3) |
| **Solved** | The pair has been confirmed equivalent | The two objects are shown as one combined tile at the partner's position, displaying both matched objects (an audio-only part shows 🔊, a letter part shows its `target`); fixed in place, not draggable, tappable to hear |
| **Returning** | A mismatched drag has ended and the object is animating back | Object animates from drop point to its exact pre-drag `pos` |

## 3. Status-dependent visibility rules

- A **Solved** pair remains visible on the board as a combined tile (per
  DEVSPEC Module 8, progress persists) — it is not removed or hidden, per the
  source brief's "no reading is required, nothing is lost" intent.
- A combined tile stays within the board and does not overlap other objects
  or the region divider.
- Audio-only objects (Better tier, §1.2) are visually distinguishable from
  image objects at all times, including while Idle, Dragging, Highlighted, and
  Solved.
- On reload mid-trial (DEVSPEC Module 8), objects previously in the Solved
  state render directly as combined tiles with no celebration; all other
  objects render Idle.
- The next-trial control is hidden until every pair in the current trial is
  solved, and stays hidden on the last trial in the index.
- Trial-selector page navigation is hidden when the pack has 12 or fewer
  trials.

## 4. Commands / interactions

| Interaction | Trigger | Result |
|---|---|---|
| Drag start | Pointer/touch down on an Idle or Returning-complete object (never a Solved tile) | Object enters Dragging state |
| Drag move | Pointer/touch move while Dragging | Object follows pointer, constrained to board bounds; Highlighted state toggles based on proximity to candidates |
| Drag release — match | Pointer/touch up while Highlighted and the candidate is equivalent (DEVSPEC Module 4) | Both objects combine into one Solved tile; match celebration plays; pronunciation plays; trial-complete celebration follows if this was the last pair |
| Drag release — mismatch | Pointer/touch up while Highlighted and the candidate is not equivalent | Negative feedback sound plays; object enters Returning state, then Idle at its original `pos` |
| Tap (no drag) | Pointer/touch down+up on an object without intervening drag movement, Better tier+ | That object's pronunciation audio plays; no state change |
| Tap Solved tile | Pointer/touch down+up on a combined tile | The partner's pronunciation plays; no state change |
| Select a trial | Tap a tile on the Trial Selector Screen | That trial's Match Board Screen is shown |
| Change selector page | Tap the previous/next page control | The selector shows the adjacent page of up to 12 trials |
| Back to selector | Tap the board's back control | The Trial Selector Screen is shown with the just-played trial's progress reflected |
| Next trial | Tap the board's next-trial control (visible only when the trial is complete and a next trial exists) | The next indexed trial's Match Board Screen is shown |

## 5. Acceptance criteria (Gherkin)

```gherkin
Feature: Matching two equivalent objects

  Scenario: Dragging an object onto its equivalent partner
    Given a trial is loaded with an object A whose pair_id includes object B
    And object A is in the Idle state
    When the learner drags object A within tolerance of object B and releases
    Then object A and object B combine into one Solved tile at B's position
    And the match celebration plays on the combined tile
    And the target's pronunciation audio plays exactly once

  Scenario: A combined tile cannot be dragged
    Given a pair is shown as a combined Solved tile
    When the learner tries to drag the tile
    Then the tile does not move

  Scenario: Tapping a combined tile replays its pronunciation
    Given a pair is shown as a combined Solved tile
    When the learner taps the tile
    Then the partner's pronunciation plays exactly once
    And the tile's state does not change

  Scenario: Completing the trial shows a distinct celebration
    Given exactly one pair remains unsolved
    When the learner matches that pair
    Then the match celebration plays on the combined tile
    And the trial-complete celebration is shown and is visually distinct

  Scenario: Pronunciation falls back to a generated voice
    Given the device is offline
    And an object's audio is missing or fails to load
    When its pronunciation should play
    Then an auto-generated voice speaks the object's target in the learning language
    And if no on-device voice is available, a synthesized tone plays instead

  Scenario: Dragging an object onto a non-equivalent object
    Given a trial is loaded with an object A whose pair_id does not include object C
    And object A is in the Idle state at position P
    When the learner drags object A within tolerance of object C and releases
    Then a negative feedback sound plays exactly once
    And object A animates back to position P
    And object A ends in the Idle state

  Scenario: Highlighting during drag
    Given object A is being dragged
    When object A comes within tolerance of candidate object B
    Then object A and object B both show the Highlighted state
    When object A moves out of tolerance of every candidate
    Then neither object shows the Highlighted state

  Scenario: Dragging never leaves the board
    Given any object is being dragged
    When the learner moves the pointer beyond the board's visible bounds
    Then the object's rendered position remains within the board's visible bounds

  Scenario: Tap-to-hear on an audio-only object (Better tier)
    Given an object has no image and is in the Idle state
    When the learner taps the object without dragging it
    Then the object's pronunciation audio plays exactly once
    And the object's state does not change

  Scenario: Matching an audio-only object to its letter (Better tier)
    Given a trial has an audio-only object A whose pair_id includes letter object B
    Then object A shows the speaker icon and not its target
    When the learner drags object A within tolerance of object B and releases
    Then object A and object B combine into one Solved tile showing the speaker icon and B's letter

  Scenario: Reloading mid-trial preserves solved pairs
    Given a trial has at least one Solved pair and at least one Idle pair
    When the game reloads
    Then the previously Solved pair renders as a combined tile with no celebration
    And the previously Idle pair renders in the Idle state

  Scenario: Loading screen clears offline within budget
    Given the device is fully offline
    When the game is launched with a valid cr_lang
    Then the Loading Screen is no longer shown within 10 seconds
    And the Match Board Screen is shown with a fully rendered trial

  Scenario: Mobile layout remains contained
    Given the game is opened on a supported mobile viewport
    When the Match Board Screen is shown
    Then the document has no horizontal or vertical page scroll
    And every object remains within the visible board bounds
    And no two objects visually overlap each other or the region divider

  Scenario: Choosing a trial from the selector
    Given the game is launched with no trial in the URL
    Then the Trial Selector Screen is shown with at most 12 tiles
    When the learner taps the tile for trial 2
    Then the Match Board Screen for trial 2 is shown

  Scenario: Paging through more than 12 trials
    Given the language pack lists 13 trials
    Then the Trial Selector Screen shows trials 1 to 12 and "Page 1 of 2"
    And the previous-page control is disabled
    When the learner taps the next-page control
    Then the selector shows trial 13 and "Page 2 of 2"

  Scenario: A completed trial is marked in the selector
    Given every pair of trial 1 has been solved
    When the Trial Selector Screen is shown
    Then the tile for trial 1 is green with a checkmark
    And its accessible name states that the trial is completed

  Scenario: Returning to the selector from a trial
    Given a trial is being played
    When the learner taps the back control
    Then the Trial Selector Screen is shown
    And the trial's solved pairs are still solved when it is reopened

  Scenario: Advancing to the next trial
    Given a trial that is not the last in the index is being played
    Then the next-trial control is not shown
    When the learner solves the last remaining pair
    Then the next-trial control is shown
    And tapping it shows the Match Board Screen for the next indexed trial
```

## 6. Open questions (UI-specific)

| ID | Question |
|---|---|
| UI-OQ-1 | Final audio-only icon artwork to replace the interim 🔊 emoji? |
| UI-OQ-3 | Exact highlight treatment (color, glow, scale) for Highlighted state? |

## Changelog

2026-09-28 — Maria Lande (with GitHub Copilot) — Added the paginated Trial Selector Screen with completed-trial marking, board back and next-trial controls, their visibility rules, interactions, and acceptance scenarios.
2026-09-28 — Maria Lande (with GitHub Copilot) — Specified transparent surfaces for image cards and combined image segments.
2026-09-28 — Maria Lande (with GitHub Copilot) — Specified larger image-trial cards and text cards that grow and wrap to fit longer targets.
2026-09-28 — Maria Lande (with GitHub Copilot) — Added letter objects and the interim 🔊 audio-only treatment with a non-revealing accessible name, defined the 🔊 + letter combined tile, added the audio-to-letter matching scenario, and narrowed UI-OQ-1 to final icon artwork.
2026-09-28 — Maria Lande (with GitHub Copilot) — Defined the Solved state as a fixed, tappable combined tile, split celebrations into a per-match and a distinct trial-complete celebration, added matching Gherkin scenarios including the generated-voice fallback, and resolved UI-OQ-2 and UI-OQ-4.
2026-09-23 — Maria Lande (with GitHub Copilot) — Replaced aspect-ratio-preserving (letterboxed/pillarboxed) board scaling with independent width/height fill of the play area, and clarified that objects derive a single square scale factor from the more constrained axis rather than stretching with the board.
2026-09-23 — Maria Lande (with GitHub Copilot) — Clarified that the board scales as a single aspect-ratio-preserving unit with proportionally sized (min-clamped) objects to prevent overlap on narrow viewports, and that mobile viewport containment applies to short-height landscape orientations too, not only narrow-width portrait viewports.
2026-09-23 — Maria Lande (with GitHub Copilot) — Approved textless loading, missing-image placeholders, and mobile viewport containment.
2026-09-23 — Maria Lande (with GitHub Copilot) — Initial draft, derived solely from Find-The-Two-That-Match-Spec-Brief.md and third-party-game-spec.md.
