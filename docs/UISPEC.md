# UISPEC — Find The Two That Match

| | |
|---|---|
| **Title** | Find The Two That Match — UI Specification |
| **Status** | Active — approved and playtested user experience |
| **Version** | 1.0.0 |
| **Last updated** | 2026-10-21 |
| **Owner/Author** | Maria Lande (with GitHub Copilot) |

This document defines layout, visual states, interactions, accessibility,
and acceptance scenarios. [PRD.md](PRD.md) defines product scope,
[DEVSPEC.md](DEVSPEC.md) defines system behavior, and
[TESTSPEC.md](TESTSPEC.md) defines verification.

## 1. Screens

### 1.1 Loading and content errors

- Loading uses a textless visual indicator with an accessible "Loading"
  status. Replace it within 10 seconds under offline conditions.
- Malformed or unavailable content shows an explicit error, not a partially
  functioning board or a substituted trial.
- Board content errors offer back navigation to the selector.
- Failed individual images or pronunciation recordings do not show the
  whole-board error; use the media fallbacks below.

### 1.2 Match board

**UI-1 — Regions**

- The board fills the available play area inside a header/footer shell.
- All `right` objects are fixed matching targets. One `left` object at a time
  appears as the draggable prompt in a separate tray.
- Portrait and square viewports: target grid above, prompt tray below.
- Landscape viewports (width greater than height): prompt tray left, target
  grid right.
- Both colored regions have 12 CSS px outer margins from the board edges
  they face. The inter-region gap is 16 CSS px.
- After outer margins and gap, the target region occupies 60% of the split
  axis and the prompt tray occupies 40%.
- Use a softly tinted green target region and warm prompt tray, with rounded
  corners and a visually distinct tray border.
- Arrange targets in authored order in a responsive grid and center the
  prompt in its tray. Authored `pos` values do not dictate placement.
- Targets do not move or disappear after matching. Progress changes only
  their indicators and transient feedback.

**UI-2 — Cards and media**

- A text object displays its target; words widen and wrap within the available
  cell/tray width. Long labels must remain fully visible.
- An image object displays its image in a square card with rounded corners
  and no colored card surface behind the image.
- An audio-only object displays a speaker icon, not its target. Use the
  accessible name "Play sound".
- Missing/corrupt images use a neutral placeholder that remains matchable.
- Prompt and target text cards retain distinct warm/green treatments.
- Cards use consistent height derived from target cells and tray space, up
  to 136 CSS px. Keep room for shadows and progress indicators.
- All cards suppress native touch selection and tap-highlight.

**UI-3 — Progress**

- Each target has a small completed/required progress indicator below it.
  Its accessible label states the two counts.
- The header shows aggregate completed versus required matches, not a score.
- A fully practised target stays visible, fixed, and available for
  tap-to-hear; its prompt stops appearing.
- Matched targets retain their own card content and fixed grid position.

### 1.3 Responsive containment

**UI-4 — Viewports and rotation**

- The entire shell fits the visual viewport without page-level scrolling.
- Support narrow portrait phones and short-height landscape screens, not
  just width-based breakpoints.
- At rest, cards, text, progress indicators, and controls remain inside their
  regions without overlapping each other or the inter-region gap.
- While dragging, the prompt can overlap targets but its full rectangle
  remains inside the board.
- Rotation switches placement without resetting repetition counts. An
  active gesture is cancelled safely.
- Supported checks include 320×568, 360×640, 414×896, 812×375, and 568×320,
  plus desktop and square viewports.

### 1.4 Entry, feedback, and completion

**UI-5 — Prompt entry**

- Each new prompt gently floats into its resting position over 400 ms.
- In portrait it enters from slightly below; in landscape from slightly left.
- Apply entry to the initial prompt and every replacement, including a
  repeated identical object.
- Under reduced motion, show it immediately without entry translation.
- Starting a drag interrupts entry animation so the card follows the gesture.

**UI-6 — Drop feedback**

- Highlight only the dragged prompt and the selected target.
- Collision eligibility uses the whole prompt/target rectangles. If a wide
  prompt overlaps several targets, select the one nearest the current
  finger/mouse position, not nearest the clamped word center.
- Do not favor the correct answer. Edge, middle, and opposite-edge targets
  must each be selectable with the same long word.
- A correct drop briefly celebrates the target and plays its pronunciation.
  Update progress, hide the consumed prompt, and present the next prompt
  after the 480 ms feedback interval.
- Incorrect and empty drops play negative feedback and return the same
  prompt to its centered tray position without incrementing progress.
- Do not accept another drag or tap pronunciation during feedback.

**UI-7 — Trial completion**

- After the final required repetition and match feedback, show a distinct
  board-level celebration with a polite "Trial complete" announcement.
- No further prompt appears once all requirements are satisfied.
- Targets and progress indicators remain visible.
- Completion feedback requires no learner action to advance the state.
  The overlay can be dismissed by pointer input without changing progress.
- Celebrations respect reduced motion; avoid motion-heavy match effects
  and hide decorative sparkles under that preference.
- Restoring a completed trial shows completed progress without replaying the
  completion celebration.

### 1.5 Trial selector

**UI-8 — Selection and pagination**

- Show the selector when no valid trial is named at launch and when back
  navigation is used.
- List the selected language pack's indexed trials ascending as numbered tiles.
- Show at most 12 tiles per page; reduce grid columns on narrow viewports.
- When several pages exist, show previous/next controls and numeric page
  position ("X / Y"). Disable the unavailable direction on either edge.
- Hide pagination when there is only one page.
- Mark completed trials green with a checkmark. Their accessible names
  include "completed"; partial and unplayed trials use the neutral treatment.
- Show aggregate completed/available trials in the header.
- Fit a full page without document or panel scrolling at supported sizes.
- Selecting a tile opens its board.

### 1.6 Board controls

**UI-9 — Navigation**

- Back and reset are always available as icon-only footer buttons.
- Back has accessible name "Back to trial selector" and retains counts.
- Reset has accessible name "Reset trial" and restarts the current trial.
- Show "Next trial" only after completion feedback ends and only if a following
  trial exists in the index.
- Accessible names/tooltips are shared English text. Language packs change
  content and pronunciation locale, not interface labels.
- Give buttons visible keyboard-focus treatment.

## 2. States

| State | Entry condition | Visible behavior |
|---|---|---|
| Entering | A prompt is newly presented | Brief float-in, or immediate placement with reduced motion |
| Idle prompt | Entry finishes or a gesture is cancelled | Centered in tray; draggable and tappable |
| Fixed target | Trial is loaded | Remains in its grid cell; tappable, never draggable |
| Dragging | Active prompt pointer exceeds 10 CSS px travel | Card follows gesture, contained in board |
| Highlighted | A collision candidate is selected | Prompt and selected target highlight together |
| Incorrect feedback | Wrong/empty drop | Same prompt returns to tray with brief feedback; counts unchanged |
| Correct feedback | Reciprocal match accepted | Target celebrates, count increases, consumed prompt hidden |
| Target satisfied | Target reaches its requirement | Full indicator; target stays visible; no more prompts for it |
| Trial complete | Every target is satisfied | No prompt; final celebration followed by completed board |

## 3. Visibility and accessibility

- Repetition counts, not object removal, represent progress.
- Keep all targets visible through feedback, satisfaction, and completion.
- Hide the prompt during correct feedback and after trial completion.
- Restore saved counts without replaying feedback or pronunciation.
- Preserve icon-only navigation and textless loading; no reading of
  instructions is needed.
- Pronunciation taps allow movement up to 10 CSS px; gestures beyond that
  threshold do not additionally play tap audio.
- Keyboard activation on a card plays pronunciation when no feedback is active.
- Audio-only cards never expose the target through their accessible name.
- Decorative regions and celebration graphics are not spoken as instructions.
- Maintain focus visibility and reduced-motion behavior.

## 4. Commands

| Input | Result |
|---|---|
| Drag prompt | Track pointer with grab offset; clamp card to board |
| Move over eligible targets | Highlight candidate nearest the pointer |
| Release over reciprocal partner | Increment that target and give correct feedback |
| Release over wrong target or empty space | Return prompt and give incorrect feedback |
| Pointer cancellation or lost capture | Return prompt without recording a match |
| Resize/rotate | Reflow regions, cancel active gesture, retain counts |
| Tap/keyboard-activate prompt or target | Play its pronunciation when idle |
| Reset | Clear current trial counts and transient state; show initial prompt |
| Back | Open selector with current progress retained |
| Next trial | Open following indexed trial after completion |

## 5. Acceptance scenarios

```gherkin
Feature: Repeated matching

  Scenario: Matching the current prompt
    Given the current prompt and target reciprocally reference each other
    When the learner drags the prompt onto the target and releases
    Then the target's completed count increases by one
    And the target celebrates and is pronounced once
    And the target stays in its grid cell
    And the next unfinished prompt floats in after feedback

  Scenario: Configurable repetition
    Given a trial requires two matches by default
    And one target overrides its requirement to four
    When every target receives its required correct matches
    Then the trial completes
    And no target receives extra prompts after its requirement is satisfied

  Scenario: A long word can aim at edge targets
    Given a wide prompt is constrained within a portrait board
    And it overlaps left, middle, and right targets
    When the learner moves the pointer over each target
    Then the pointed-at target highlights independently of the card center
    And release checks that target without preferring the correct answer

  Scenario: Incorrect or empty drop
    Given the current prompt is idle in its tray
    When the learner drops it on a wrong target or empty space
    Then negative feedback plays once
    And the same prompt returns to its tray
    And repetition counts do not change

  Scenario: Cancelling a drag
    Given the learner is dragging the prompt
    When pointer input is cancelled or capture is lost
    Then the prompt returns to its tray without incrementing a count

  Scenario: Changing orientation
    Given a portrait trial has saved partial progress
    When the viewport becomes landscape
    Then targets appear on the right and the prompt on the left
    And both areas retain equal outer margins
    And counts remain unchanged
    And matching works at the new target positions

  Scenario: Tap-to-hear with minor movement
    Given a prompt or target is idle
    When a tap moves no farther than 10 CSS px
    Then its pronunciation plays once
    And no count changes or text-selection highlight appears

  Scenario: Audio-only presentation
    Given the prompt has type audio
    Then it shows a speaker icon without revealing its target
    And it can be heard and matched through the same interactions

  Scenario: Completing and restoring a trial
    Given one required repetition remains
    When the learner matches it
    Then the target celebrates followed by a distinct trial celebration
    And no further prompt appears
    When the page reloads
    Then completion is restored without replaying feedback

  Scenario: Reduced-motion entry
    Given reduced motion is requested
    When a new prompt is presented
    Then it appears in its resting position without translation

  Scenario: Trial navigation
    Given the pack lists thirteen trials
    Then the selector shows twelve tiles on the first page
    And the second page shows trial thirteen
    When a completed trial is shown in the selector
    Then its tile has a green checkmark and completed accessible name
    And next-trial navigation is available only after completion
```

## Changelog

2026-10-21 — Maria Lande (with GitHub Copilot) — Replaced the document with unified screens, states, accessibility rules, and acceptance scenarios for responsive repeated matching.
