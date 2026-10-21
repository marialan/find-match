# PRD — Find The Two That Match

| | |
|---|---|
| **Title** | Find The Two That Match — Product Requirements Document |
| **Status** | Active — approved behavior |
| **Version** | 1.0.0 |
| **Last updated** | 2026-10-21 |
| **Owner/Author** | Maria Lande (with GitHub Copilot) |

This document defines product goals and scope for Find The Two That Match.
The product brief supplies the literacy goals, approved product decisions
define the matching interaction, and [the third-party game contract](third-party-game-spec.md)
defines offline delivery and container integration.

## 1. Product summary

Find The Two That Match is an offline literacy game for early readers.
Learners drag one prompt onto its equivalent target among a fixed set of
letters, words, pictures, or audio objects. A correct match celebrates the
target, plays its pronunciation, and introduces another prompt. Targets stay
in place so the learner can practise the same relationship multiple times
within one trial.

The board has two visually separate areas:

- Portrait and square viewports: targets above, prompt below.
- Landscape viewports: prompt on the left, targets on the right.

Incorrect drops return the prompt to its tray without losing progress.
The trial finishes when every target has received its required repetitions.
The default is three successful matches per target; content authors can
change this per trial and per target.

The game runs entirely offline inside the Curious Reader container from a
`file://` URI and reports trial completions through the `cr_event` bridge.

## 2. Goals

- Teach equivalence through repeated, forgiving drag-and-drop practice.
- Support letter/letter, letter/audio, word/picture, and rhyme relationships.
- Require no reading of instructions to operate; convey interaction through
  layout, highlighting, motion, and audio.
- Preserve progress without scoring, ranking, or performance pressure.
- Remain usable in portrait and landscape, including narrow phones and
  short-height screens.
- Let authors supply new trials, media, repetition counts, and languages
  without changing game code.
- Run with no network access, including media playback and pronunciation
  fallbacks.

## 3. Personas

| Persona | Needs |
|---|---|
| Learner, roughly ages 4–8, not yet reliably reading | A discoverable interaction, clear feedback, repeated practice, and no loss of progress after an incorrect attempt |
| Content author | A documented JSON schema, reciprocal pair relationships, configurable practice counts, and local media paths |
| Curious Reader integrator | Offline engine/language ZIPs and compliant completion reporting |

## 4. Key user scenarios

1. A learner chooses a trial and sees fixed targets and one prompt. The prompt
   floats into its tray. Dragging it over a target highlights the candidate.
   A correct drop celebrates and pronounces the target, updates its progress,
   and replaces the prompt after feedback.
2. A learner repeats matches across the targets. Targets remain visible and
   available throughout; prompts for satisfied targets stop appearing.
3. A learner drags a long word towards an edge target. The word remains inside
   the board, while the finger/mouse position selects among overlapping
   targets. The center target must not prevent aiming at either edge.
4. A learner makes an incorrect or empty drop. The prompt returns to its tray
   and can be tried again; no repetition is credited.
5. A learner rotates the device or leaves and returns to the trial.
   Placement adapts to orientation and saved repetition counts remain intact.
6. An author supplies `left` prompt definitions, `right` target definitions,
   reciprocal `pair_id` values, optional media, and repetition overrides.
7. An integrator installs the engine and language ZIPs, plays offline, and
   observes exactly one completion event and one summary update when a trial
   transitions to complete.

## 5. Success criteria

- The selector or requested trial becomes playable within 10 seconds offline.
- No attempted network requests or `NETGUARD_BLOCK` entries occur.
- Every authored reciprocal pair is matchable at supported viewport sizes,
  including long prompts and targets near board edges.
- Correct matches increment only the selected target's repetition count.
- Completion requires all configured repetitions, not just one match per pair.
- Reloading restores counts without replaying feedback or completion events.
- Exactly one `user_sessions_data` completion event and one `summary_data`
  update occur per completion transition; none occur per intermediate match.
- The learner can operate the game without reading instructions.
- The shell, target grid, tray, and selector fit without page scrolling.

## 6. Functional scope

### 6.1 Matching and repetition

- Show all fixed targets and one draggable prompt.
- Generate placement from the available space rather than authored positions.
- Use equal outer margins for the colored regions and a consistent gap.
- Float each newly presented prompt into place; disable entry motion under
  reduced motion and interrupt it when dragging starts.
- Match by reciprocal IDs, not by text equality or an answer-aware target bias.
- Use full-card proximity for collision eligibility and pointer-based aiming
  when several targets qualify.
- On success, play feedback and target pronunciation, retain the target,
  increment its count, and replenish the prompt.
- Cycle through unfinished targets with the lowest completed count, using
  authored prompt order to break ties.
- Default to three repetitions, overridden by the trial count and then by
  each target's own count.
- On an incorrect or empty drop, return the prompt without changing counts.
- Keep the dragged card on-screen; cancellation never credits a match.
- Show per-target practice progress and aggregate completed/required matches,
  without presenting them as a score.

### 6.2 Content and audio

- Support letters, words, images, rhymes, and audio-only objects.
- Tap a prompt or target to hear its pronunciation when no feedback is active.
- Audio-only objects use a speaker affordance without revealing their target.
- Use local recordings first, then on-device speech in the learning language,
  then a synthesized tone.
- Failed media does not block the trial; failed images use a neutral placeholder.
- Trial content and language metadata are supplied as local JSON and media.

### 6.3 Progress and navigation

- Persist counts per language and trial on the device.
- Reset counts when the target/pair/repetition configuration changes.
- Offer a trial selector with ascending trial numbers, at most 12 per page,
  navigation between pages, and completion marking.
- Provide back and reset controls at all times on the board.
- Show next-trial navigation only after completion and only when a following
  indexed trial exists.
- Preserve the selected trial in the launch URL where supported.

## 7. Non-goals

- Competitive scoring, rankings, leaderboards, or grading.
- Account creation, login, multiplayer, or networked interaction.
- In-game trial or language-pack authoring.
- Online media, cloud speech, analytics SDKs, or network telemetry.
- A separate non-drag matching input method; tap and keyboard activation
  serve pronunciation and navigation, not click-to-select matching.

## 8. Delivery milestones

1. **M1 — Repeated matching:** letters, fixed targets, replenishing prompts,
   configurable counts, feedback, responsive placement, and saved progress.
2. **M2 — Audio interaction:** audio-only objects, tap-to-hear, and offline
   pronunciation fallbacks.
3. **M3 — Rich content:** words, pictures, rhymes, and long-word edge aiming.
4. **M4 — Container delivery:** offline runtime, completion reporting,
   language-pack discovery, ZIP packaging, and extracted-package verification.

## 9. Container and content constraints

- Ship as static files loaded from `file://`, without a server, Service Worker,
  Cache Storage, or runtime network I/O.
- Read `cr_lang`, `cr_user_id`, and optional `trial` launch parameters.
- Use English when the requested language is absent or unavailable; report
  malformed installed content rather than silently substituting another pack.
- Keep interface labels and accessible control names in shared English;
  language packs provide learning content and speech locale.
- Treat `cr_user_id` as opaque; collect no additional identifying information.
- Report only through the Curious Reader `postMessage` bridge.
- Deliver `findmatch-core.zip` plus a separate `findmatch-lang-<code>.zip`
  for each language, following Layout A of the container contract.
- The checked-in English content is development/test material, not approved
  learning content for release.

## Changelog

2026-10-21 — Maria Lande (with GitHub Copilot) — Replaced the document with a unified specification of repeated matching, responsive regions, configurable practice, and pointer-aimed interaction.
