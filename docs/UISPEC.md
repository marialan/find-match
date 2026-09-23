# UISPEC — Find The Two That Match

|                  |                                                   |
| ---------------- | ------------------------------------------------- |
| **Title**        | Find The Two That Match — UI Specification         |
| **Status**       | Draft                                             |
| **Version**      | 0.1.0                                             |
| **Last updated** | 2026-09-23                                        |
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
  - **Image object** — has an `image`; renders that image.
  - **Audio-only object** (Better tier) — has no `image`; renders a distinct,
    non-text visual affordance indicating it is tappable/audible (exact
    treatment: Open Question UI-OQ-1).
- The board's usable area never allows an object's rest or dragged position to
  extend past its visible bounds (DEVSPEC Module 3).

### 1.3 Celebration Overlay
- Appears over the Match Board Screen when a pair is confirmed equivalent
  (DEVSPEC Module 5).
- Non-blocking to the rest of the board: other unsolved pairs remain visible
  and interactive during/after the overlay (state detail: Open Question
  UI-OQ-2).
- Dismisses automatically; no learner action is required to continue.

## 2. States

| State | Entry condition | Visible characteristics |
|---|---|---|
| **Idle** | Object at rest, not being dragged, not highlighted | Rendered at its authored `pos` |
| **Dragging** | Learner has an active pointer/touch drag on the object | Object follows pointer; constrained within board bounds |
| **Highlighted** | A dragged object is within tolerance of a candidate partner (or vice versa) | Both the dragged object and the candidate show a highlight treatment (exact visual: Open Question UI-OQ-3) |
| **Solved** | The pair has been confirmed equivalent | Both objects show a persisted "solved" treatment; celebration overlay has played at least once |
| **Returning** | A mismatched drag has ended and the object is animating back | Object animates from drop point to its exact pre-drag `pos` |

## 3. Status-dependent visibility rules

- An object in the **Solved** state remains visible on the board (per DEVSPEC
  Module 8, progress persists) — it is not removed or hidden after being
  solved, per the source brief's "no reading is required, nothing is lost"
  intent. (Confirm exact post-solve treatment: Open Question UI-OQ-4.)
- Audio-only objects (Better tier, §1.2) are visually distinguishable from
  image objects at all times, including while Idle, Dragging, Highlighted, and
  Solved.
- On reload mid-trial (DEVSPEC Module 8), objects previously in the Solved
  state render directly in Solved state; all other objects render Idle.

## 4. Commands / interactions

| Interaction | Trigger | Result |
|---|---|---|
| Drag start | Pointer/touch down on an Idle or Returning-complete object | Object enters Dragging state |
| Drag move | Pointer/touch move while Dragging | Object follows pointer, constrained to board bounds; Highlighted state toggles based on proximity to candidates |
| Drag release — match | Pointer/touch up while Highlighted and the candidate is equivalent (DEVSPEC Module 4) | Celebration Overlay shown; audio pronunciation plays; both objects enter Solved state |
| Drag release — mismatch | Pointer/touch up while Highlighted and the candidate is not equivalent | Negative feedback sound plays; object enters Returning state, then Idle at its original `pos` |
| Tap (no drag) | Pointer/touch down+up on an object without intervening drag movement, Better tier+ | That object's pronunciation audio plays; no state change |

## 5. Acceptance criteria (Gherkin)

```gherkin
Feature: Matching two equivalent objects

  Scenario: Dragging an object onto its equivalent partner
    Given a trial is loaded with an object A whose pair_id includes object B
    And object A is in the Idle state
    When the learner drags object A within tolerance of object B and releases
    Then object A and object B both enter the Solved state
    And the Celebration Overlay is shown
    And the target's pronunciation audio plays exactly once

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

  Scenario: Reloading mid-trial preserves solved pairs
    Given a trial has at least one Solved pair and at least one Idle pair
    When the game reloads
    Then the previously Solved pair renders in the Solved state
    And the previously Idle pair renders in the Idle state

  Scenario: Loading screen clears offline within budget
    Given the device is fully offline
    When the game is launched with a valid cr_lang
    Then the Loading Screen is no longer shown within 10 seconds
    And the Match Board Screen is shown with a fully rendered trial
```

## 6. Open questions (UI-specific)

| ID | Question |
|---|---|
| UI-OQ-1 | Exact visual affordance for an audio-only object (icon, waveform glyph, speaker icon, etc.)? |
| UI-OQ-2 | Does the Celebration Overlay block interaction with other pairs while shown, or is it purely decorative and non-blocking? |
| UI-OQ-3 | Exact highlight treatment (color, glow, scale) for Highlighted state? |
| UI-OQ-4 | Does a Solved object remain interactive (draggable) afterward, or become fixed/locked in place? |

## Changelog

2026-09-23 — Maria Lande (with GitHub Copilot) — Initial draft, derived solely from Find-The-Two-That-Match-Spec-Brief.md and third-party-game-spec.md.
