# UISPEC — Find The Two That Match

| | |
|---|---|
| **Title** | Find The Two That Match — UI / Interaction Specification |
| **Status** | Active — pre-implementation |
| **Version** | 1.0.0 |
| **Last updated** | 2026-09-22 |
| **Owner/Author** | Maria Lande (with GitHub Copilot) |

> This UISPEC defines the **user-facing surface**: layout, visual system, every
> screen/phase, and the acceptance criteria for the key interactions. It realizes
> the PRD and **references the DEVSPEC for behavior** rather than restating it.
> Where a rule concerns *how it works*, this document cites the DEVSPEC;
> where it concerns *how it looks, moves, or feels*, the rule lives here.
>
> All numeric constants originate in **DEVSPEC §I.1.1** and are cited by id.

**Reference chain:** PRD → DEVSPEC → **UISPEC** → TESTSPEC.

---

## 1. Canvas & layout geometry

- **Reference canvas: `REF_W` × `REF_H` = 1280 × 720.** All geometry is authored
  in this fixed 16:9 space and **cover-scaled** to the device
  (`--ftm-scale = max(vw/1280, vh/720)`), so a 16:9 device maps 1:1 and other
  aspect ratios crop the background only. Pointer coordinates convert back via
  `screenToStage()` (DEVSPEC FR-DRAG-02).
- **Safe area:** inset `SAFE_MARGIN` = 64 on all four sides → 1152 × 592. Every
  interactive element is authored inside it and clamped to it while dragged
  (DEVSPEC FR-DATA-03, FR-DRAG-04). Background texture may bleed to the device
  edges; nothing interactive may.
- **The split:** `DIVIDER_X` = 640. Left objects live in `x < 640`, right objects
  in `x > 640` (DEVSPEC FR-DATA-03). The divider must read as **two places, not a
  barrier** — objects cross it freely and nothing about it may suggest an edge or
  a wall. Its treatment is left to implementation (§2).
- **Object tiles:** `OBJECT_W` × `OBJECT_H` = 160 × 160. Word
  objects may widen with glyph count (min 160, grow by glyph advance), and never
  shrink below `MIN_TOUCH` = 88 in either dimension.
- **Recommended authoring grid:** up to 6 objects per side, in a single column at
  `x = 320` (left) / `x = 960` (right), rows starting at `y = 160` with a 176px
  pitch. This is guidance for content authors, not an engine constraint — `pos`
  is free within the safe area and its side.

## 2. Visual language

**No instructional text.** The only glyphs on screen are the
`target` strings of `letter` and `word` objects (DEVSPEC NFR-CON-01).

This is a first-draft visual direction for implementation. It is intentionally
simple and may be revised later as design is refined. The goal is to give the
engine and UI a clear starting point without locking the final art direction.

Draft visual direction:

- **Palette:** warm, light, child-friendly colors on a paper-like background; soft
  neutral board surfaces; clear contrast for all content and feedback states.
- **Tiles:** rounded, tactile cards with a subtle shadow and consistent border so
  objects read as movable before dragging.
- **Divider:** a gentle seam between left and right sides, not a wall or edge.
- **Audio mark:** a small, non-textual sound cue for `audio` objects.
- **Feedback:** candidate highlight, match, reject, and loading states are all
  visually distinct and readable without relying on color alone.
- **Motion:** brief, smooth ease-out motion, with no meaning carried by animation
  alone.

Constraints:

- **Legible on low-cost panels in daylight.** Content glyphs and every feedback
  treatment meet or exceed 4.5:1 contrast against whatever they sit on (§7).
- **One bundled type face** for all content glyphs, loaded via `FontFace` from an
  ArrayBuffer (DEVSPEC NFR-OFF-04). No other type appears anywhere in the product.
- **Objects must read as movable** before a child has moved anything.
- **Four feedback states, four distinguishable treatments** (§4). Each must be
  distinguishable by more than color alone, and each is also carried by audio.
- **Nothing signals failure.** The reject treatment reads as "not that one" —
  never as an alarm, an error, or a penalty (DEVSPEC NFR-CON-02).
- **Motion is brief and ease-out.** Durations come from DEVSPEC §I.1.1
  (`REPEL_MS`, `CELEBRATE_MS`, `TRIAL_COMPLETE_MS`); nothing snaps instantly and
  nothing outlasts its constant.
- **No information exists only in motion** (§7).

## 3. Object kinds — what each must convey

Presentation only; `kind` never affects matching (DEVSPEC FR-MATCH-02). Each kind
below states what the object must communicate, not how it should look.

### 3.1 `letter`
Its single glyph, and nothing else. Lowercase and uppercase must differ **only**
by the glyph — no size, color, position, or badge cue about which case it is, and
nothing that visually pairs them. Discovering the pair is the learning.

### 3.2 `word`
The whole word, with even letter spacing and no syllable seams, color banding, or
other sub-word segmentation cue.

### 3.3 `picture`
The image, with its aspect ratio preserved and **no caption ever** — the picture
is the whole content. A missing image renders a neutral placeholder that stays
fully interactive (DEVSPEC NFR-ERR-03).

### 3.4 `audio`
A **non-textual mark that reads as "this speaks"** — no glyphs, and no reliance on
a device metaphor a child may never have seen. It must invite touch at rest and
visibly respond during playback, since hearing it is the entire content of the
object.

## 4. Feedback states — the four signals

These four are the entire feedback language. Nothing else is signalled. The visual
column states what each treatment must accomplish; its styling is left to
implementation (§2).

| State | Visual requirement | Audio (DEVSPEC FR-AUD-03) | Haptic |
|---|---|---|---|
| **Touched / picked up** | The object reads as lifted off the board and renders above every other object | `pickup` | — |
| **Candidate highlight** | **Both** objects carry the same, clearly visible highlight treatment simultaneously | `hover`, once on entering candidacy — not repeated while held | — |
| **Match** | Both objects celebrate together with ≤ `PARTICLE_MAX` particles, then settle into a visibly inert state | `match`, then the target audio pronouncing the word or letter | `VIBRATE_MS`, skipped silently where unsupported |
| **Reject** | The dragged object shows a brief, non-alarming rejection, then glides back to its pick-up position over `REPEL_MS` | `reject` — a soft low thud, never a buzzer | — |

The candidate object is **never** altered by a reject: the child's attention stays
on their own object, so the mistake reads as "not this one", not "you broke that".

## 5. Phase-by-phase screens & states

Phases and their behavior are defined in DEVSPEC §I.0 / §I.2. This section defines
what each phase must **present**; styling is left to implementation (§2).

### 5.1 `loading`
A minimal, textless loading indicator. No objects, no divider.
Present while the pack, font, images, and progress load. Leaves to `present` as
soon as the trial's assets have settled (DEVSPEC FR-AUD-07) — never gated on the
network, and never longer than a beat on a warm start.

### 5.2 `present`
- The divider establishes first, then the trial's objects **arrive one after
  another**, left side then right. The arrival order is the only sequencing cue;
  there is no pointing hand, arrow, or text.
- Objects rest with a barely-perceptible idle motion, out of
  phase with each other so the board feels alive rather than mechanical.
- **M2 onward:** any object may be tapped to hear its target (DEVSPEC FR-AUD-04),
  and shows a visible response in time with the audio. In M1 a tap performs no
  action. Taps are ignored during `loading`, match celebration, reject/rebound,
  and any other non-present transition.
- Already-matched objects from a resumed trial render **inert** from the start
  (DEVSPEC FR-ENG-05) — visibly settled, no idle motion, and (from M2) still
  tappable.

### 5.3 `dragging`
- The dragged object is lifted per §4 and tracks the pointer exactly, offset by the
  grab point so it never jumps under the finger.
- It is **clamped to the safe area** (DEVSPEC FR-DRAG-04). At the clamp boundary
  the object simply stops; it does not rubber-band, flash, or resist — the child
  should never learn that an edge is a punishable place.
- When a candidate exists, **both** objects highlight per §4. When the drag moves
  out of tolerance, both highlights release together. Highlight and acceptance
  share one `TOLERANCE` (DEVSPEC FR-MATCH-01), so what is highlighted is always
  what will be evaluated. If two candidates are equally close, the nearer object
  wins; if still tied, the lower `object_id` wins.
- Other objects stay fully visible and un-dimmed — the board is never masked during
  a drag.

### 5.4 `resolving`
- **Match:** §4 match feedback, running `CELEBRATE_MS`. The matched pair then
  settles **in place** — neither object moves to the other side, neither is
  removed. The board is a record of what the child has figured out.
- **No match with a candidate:** §4 reject feedback over `REPEL_MS`, returning the
  object to the exact pick-up position (DEVSPEC FR-MATCH-04).
- **No candidate:** the object returns to its pick-up position over `REPEL_MS` with
  **no sound and no rejection treatment** (DEVSPEC FR-MATCH-05). A cancelled drag
  must feel different from a wrong answer. The error counter is not incremented.

### 5.5 `trialComplete`
When the last pair matches (DEVSPEC FR-ENG-06), the individual match celebration
plays first, then: all matched objects respond in turn left-to-right
while each plays its target audio back-to-back — a spoken, textless recap —
with a rising chime and ≤ `PARTICLE_MAX` particles. Total `TRIAL_COMPLETE_MS`.
The objects then exit and the next trial's objects arrive
(§5.2), overlapping the exit so there is **no empty screen and no dead wait**.

### 5.6 `sessionComplete`
There is **no end screen**. After the final authored trial's celebration, the game
loops to the first trial exactly as any other transition (DEVSPEC FR-ENG-08). The
child can always keep playing.

## 6. Status-dependent visibility rules

| Element | Visible / active when |
|---|---|
| Loading indicator | `loading` only |
| Divider | all phases except `loading` |
| Objects (unmatched) | `present`, `dragging`, `resolving` — draggable, and tappable from M2 |
| Objects (matched, inert) | all phases after their match — tappable from M2, **not** draggable |
| Lifted / dragged treatment | `dragging` only, on the dragged object only |
| Candidate highlight treatment | `dragging`, on exactly two objects, only while a candidate exists |
| Match celebration | `resolving` (match) and `trialComplete` |
| Reject treatment | `resolving` (no match **with** a candidate) only |
| Audio-playback indicator | during any target-audio playback |
| Any instructional text, score, timer, or button | **never** |

## 7. Accessibility & input

- **Touch-first, single-pointer** (DEVSPEC NFR-CON-05). No interaction requires
  hover, keyboard, right-click, or multi-touch. Mouse and pen use the same path,
  so desktop QA exercises the shipping code.
- Every interactive object is at least `MIN_TOUCH` (88 reference px) on both axes.
- Contrast: content glyphs and every feedback treatment meet or exceed 4.5:1
  against whatever they sit on.
- Motion is decorative only — no information exists solely in an animation; every
  state also has a static visual and an audio signal.
- Haptics are feature-detected and silently skipped (DEVSPEC FR-MATCH-03).
- Audio is never required to succeed: every match is achievable from the visuals
  alone for `letter`, `word`, and `picture` objects. `audio` objects are the one
  deliberate exception — hearing them *is* the exercise.

## 8. Acceptance criteria (Gherkin)

Behavior these verify is specified in the DEVSPEC; the TESTSPEC traces test cases
to each scenario below.

```gherkin
Feature: Split interface from trial data

  Scenario: A trial is laid out exactly as authored
    Given a trial file places three objects on the left and three on the right
    When the trial loads
    Then each object appears at its authored centre position in the reference canvas
    And every left object is left of the divider and every right object is right of it
    And no object overlaps the safe-area margin

Feature: Tap to hear (M2 onward)

  Scenario: Child taps an object without moving it
    Given the game is in the "present" phase
    When the child presses an object and releases it under the tap ceiling with
      less than the drag threshold of travel
    Then that object's target audio plays and the object responds visibly
    And the object does not move

  Scenario: A drag is never mistaken for a tap
    Given the child presses an object
    When the pointer travels beyond the drag threshold
    Then the gesture becomes a drag and no target audio is triggered by the release

Feature: Dragging and containment

  Scenario: Child drags an object around the screen
    Given the game is in the "present" phase
    When the child presses an object and moves the pointer
    Then the object lifts, tracks the pointer, and renders above all other objects

  Scenario: Child cannot drag an object off the screen
    Given the child is dragging an object
    When the pointer moves beyond the safe area in any direction
    Then the object's position is clamped so its full bounds stay inside the safe area
    And the object remains under the child's control with no rubber-band or flash

Feature: Proximity highlight

  Scenario: Both objects highlight within tolerance
    Given the child is dragging an object
    When its centre comes within the match tolerance of another unmatched object's centre
    Then both the dragged object and that object show the highlight treatment
    And the highlight sound plays once on entering candidacy

  Scenario: Highlight releases when the drag moves away
    Given two objects are highlighted during a drag
    When the dragged object moves beyond the match tolerance
    Then both highlights release and no object is highlighted

  Scenario: The nearest object wins
    Given two unmatched objects are both within tolerance of the dragged object
    Then only the nearer one is highlighted as the candidate

Feature: Equivalence on release

  Scenario: Equivalent objects match
    Given the child is dragging a lowercase letter object
    And it is highlighted with the matching uppercase letter object
    When the child lifts their finger
    Then both objects are marked matched and become inert to dragging
    And a celebration animation plays
    And the audio pronouncing the letter plays
    And a haptic pulse fires where supported
    And a "pair_matched" event is emitted at the end of the celebration

  Scenario: Non-equivalent objects are rejected
    Given the child is dragging an object
    And it is highlighted with an object that is not equivalent to it
    When the child lifts their finger
    Then a soft negative sound plays and the dragged object shows the rejection treatment
    And the dragged object glides back to the exact position it was picked up from
    And the other object is left completely unchanged
    And the trial's error counter increments
    And no fail state, buzzer, or penalty occurs

  Scenario: Releasing with no candidate is not an error
    Given the child is dragging an object with no object within tolerance
    When the child lifts their finger
    Then the object returns to its pick-up position with no sound and no rejection treatment
    And the error counter does not increment

Feature: Cross-kind equivalence

  Scenario: A letter matches a letter-sound audio object
    Given a trial pairs a letter object with an audio object
    When the child drags either one onto the other
    Then the pair matches exactly as two letter objects would

  Scenario: A word matches its picture
    Given a trial pairs a word object with a picture object
    When the child drags either one onto the other
    Then the pair matches and the word's audio plays

  Scenario: Two rhyming words match
    Given a trial pairs two word objects that rhyme
    When the child drags either one onto the other
    Then the pair matches

Feature: Matched objects

  Scenario: A matched object cannot be dragged but can be heard
    Given an object has been matched
    When the child presses and drags it
    Then it does not move
    When the child taps it
    Then its target audio plays (M2 onward)

Feature: Trial completion and continuation

  Scenario: Last pair completes the trial
    Given every pair in the trial has been matched except one
    When the child matches the final pair
    Then the matched objects respond in turn left to right, each replaying its target audio
    And a celebration plays with a rising chime
    And a "trial_completed" event is emitted with score, max_score, errors and duration
    And the next trial's objects arrive before the screen is ever empty

  Scenario: The game never dead-ends
    Given the child has completed the final authored trial
    Then the first trial loads again with progress preserved
    And no end screen, exit button, or score summary is shown

Feature: Resume

  Scenario: Reload mid-trial restores exactly
    Given the child has matched two of four pairs in a trial
    When the game is closed and reopened
    Then the same trial loads with those two pairs already matched and inert
    And the unmatched objects are back at their authored positions
```

---

## Changelog

- 2026-09-22 — GitHub Copilot & Maria Lande — Initial spec authored
