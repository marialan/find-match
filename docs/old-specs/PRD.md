# PRD — Find The Two That Match

|                  |                                                         |
| ---------------- | ------------------------------------------------------- |
| **Title**        | Find The Two That Match — Product Requirements Document |
| **Status**       | Active — pre-implementation                             |
| **Version**      | 1.0.0                                                   |
| **Last updated** | 2026-09-22                                              |
| **Owner/Author** | Maria Lande (with GitHub Copilot)                       |

> This PRD is the stable _what_ and _why_ for Find The Two That Match. It is
> conceptual and does not describe implementation, and it does not reference the
> DEVSPEC, UISPEC, or TESTSPEC by filename — those documents reference back to
> this one.

---

## 1. Product summary

Find The Two That Match is an **offline literacy web game for children ages 4–8**.
The screen is split into two sides. Objects sit on the left, their partners sit on
the right. The child drags an object across the divide and drops it onto the one
it belongs with. When the two are equivalent — lowercase `c` with uppercase `C`,
a word with its picture, a word with a word that rhymes — the pair celebrates and
the child hears the target spoken aloud. When they are not, a soft negative sound
plays and the object glides back to exactly where the child picked it up.

Nothing is lost, nothing is scored against the child, and no reading is required
to operate the game.

The game ships inside **Curious Learning's Curious Reader** container — an
offline-first Android/iOS WebView that loads the game from the local `file://`
protocol with **no network access at runtime**. Find The Two That Match must
therefore be a fully self-contained, client-only experience: all art, audio,
fonts, and trial data are bundled and loaded locally, and all progress is stored
on-device.

The experience uses little to no instructional text. Instead, symbols, images, animation,
sound, and other visual cues guide children through the app and help them understand what
to do.The goal is for a pre-literate child, or a child who does not read the UI language,
to use the app independently.

## 2. Target users & context

### Primary user — the child (ages 4–8)

- Pre-literate to early-literate. May not yet know that `c` and `C` are the same
  letter, and cannot read instructions.
- Plays on a **low-cost Android device** (target: 1GB-RAM WebView) or iOS, often
  offline, frequently unsupervised, in a range of languages and regions served by
  Curious Learning.
- Interaction is **touch-only, single-finger**. Attention spans are short; the
  loop must be legible within seconds of the first screen.

### Secondary stakeholders

- **Curious Learning / Curious Reader team** — owns the container, the CMS that
  distributes games, the analytics pipeline, and the go-live/promotion decision.
  Find The Two That Match is a third-party title uploaded into their platform.
- **Content authors / localizers** — author trial sets (letters, words, pictures,
  rhymes) and record the matching audio for each language. They work in a data
  file, never in code.
- **Caregivers / educators** — not direct users, but the literacy outcome and the
  no-fail design serve their trust.

### Learning context

The game teaches **equivalence**: the recognition that two different
representations can be the same thing. This underpins letter-case knowledge
(`a`/`A`), grapheme–sound mapping (a letter and the sound it makes),
word–referent mapping (the word _cat_ and a picture of a cat), and rhyme
awareness (_cat_ / _hat_). Dragging one object physically onto the other makes
the abstract claim "these two are the same" into a concrete act.

## 3. Personas

- **Amara, 5, first-time reader (Kenya, offline Android).** Doesn't yet know that
  `b` and `B` are the same letter. She drags `b` onto `B`, hears "buh", and the
  pair blooms. She drags `b` onto `D`, hears a soft thud, and the letter slides
  home — nothing bad happened, so she tries again immediately.
- **Mateo, 7, building fluency (tablet, intermittent wifi).** Works through the
  picture and rhyming trials. Taps objects just to hear them before committing,
  and finishes a trial with zero mistakes.
- **Nadia, content author (Curious Learning partner).** Authors a new language's
  trial file and records one audio clip per target. She never opens the game's
  source code; the trial file and the audio folder are her whole surface.
- **The Curious Learning content operator.** Uploads the engine plus a language
  pack through the CMS, verifies the tile appears, and promotes it to production.
  Needs the game to be packaging-compliant and to emit clean analytics events.

## 4. Core value proposition

- **Equivalence you can feel.** The child physically carries one object to the
  other; the match is a collision, not a multiple-choice answer.
- **Truly offline & universal.** Runs with zero network, in any Curious Reader
  language, on cheap hardware, with no reading required to operate it.
- **No-fail by construction.** A wrong drop is a sound and a graceful return to
  the starting position — never a buzzer verdict, a lost life, or a game-over.
- **Authored, not hard-coded.** Every trial — which objects, where they sit, what
  matches what — comes from a data file, so new languages and new equivalence
  types are content work, not engineering work.
- **One mechanic, three depths.** The same drag-and-drop gesture carries
  letter-case matching, sound matching, word–picture matching, and rhyme matching,
  so the game grows with the child without teaching a new interaction.

## 5. Success metrics / KPIs

Analytics are reported through the container's data bridge (session, pair, trial,
and rolled-up summary events). Target signals:

- **Engagement:** median session length; trials completed per session; return
  sessions per child.
- **Progression:** share of children who complete the full authored trial
  sequence; distribution of furthest trial reached.
- **Learning-proxy quality:** incorrect drops per trial _trending down_ within a
  session and across sessions (equivalence is being learned, not guessed); time to
  first correct match per trial trending down.
- **Comprehension of the affordance:** share of trials in which the child makes at
  least one successful match within the first 30 seconds (the mechanic is legible
  without instruction).
- **Reliability (non-negotiable):** the game launches and runs fully offline from
  `file://`; audio plays from bundled files in the shipped container; no crashes
  on the 1GB-RAM target device; no object is ever lost off-screen.
- **Distribution:** engine + language pack upload cleanly to the CMS and appear on
  devices after promotion.

## 6. Scope & milestone history

The product is defined in three delivery tiers, taken directly from the workshop
brief. Each tier is independently shippable and adds to the one before it without
changing the core gesture.

| Milestone       | Status  | What it delivers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1 — MVP**    | Planned | Split left/right interface populated from a trial data file. Letter objects only (lowercase and uppercase). Drag an object; both objects highlight when the dragged one is within tolerance of another; on release, equivalent pairs play a celebration animation plus the spoken target, non-equivalent pairs play a negative sound and the dragged object returns to where it was picked up. Objects cannot be dragged off-screen. On-device progress. Container analytics. Offline `file://` build and upload ZIPs. |
| **M2 — Better** | Planned | Audio-only objects (an object whose whole identity is a sound). Tapping any object plays its target audio. Equivalence between a letter and a letter-sound audio object.                                                                                                                                                                                                                                                                                                                                               |
| **M3 — Great**  | Planned | Word objects, picture objects, and rhyming-word objects. Equivalence between a word and a picture, and between two rhyming words.                                                                                                                                                                                                                                                                                                                                                                                      |

### Product principles (stable)

- **No instructional text.** The only glyphs are content glyphs.
- **No fail state.** A wrong drop returns the object to its pick-up position with
  a soft sound. Nothing is deducted, nothing is locked.
- **Equivalence is authored, never inferred.** Two objects match if and only if
  the trial data says they do.
- **Every object is audible.** Anything the child can touch can be heard.
- **Offline-first.** If it needs the network, it is out of scope.
- **The child cannot break it.** No object can leave the screen, be destroyed, or
  end up somewhere it cannot be picked up again.

## 7. Non-goals / explicitly out of scope

- **No backend or accounts.** The game is client-only; there is no server-side
  game logic, login, or cloud save.
- **No online features** — no leaderboards, multiplayer, ads, or in-app purchases.
- **No authoring/CMS UI inside the game.** Trial content is authored as a bundled
  language-pack data file, not edited in-app.
- **No procedural trial generation.** Trials are hand-authored; the game never
  invents pairs or positions.
- **No timers, scores shown to the child, stars, or leaderboards.** Scoring exists
  only as analytics.
- **No free placement.** An object dropped away from a partner returns to its
  pick-up position; the brief's original "leave it anywhere" behavior is
  explicitly struck.
- **Publishing/promotion to Curious Reader production** is a separate, externally
  gated activity owned by the Curious Learning team.
- **Non-English language packs** are supported by the architecture from day one
  but are authored per-language as separate content work.
- **Reading comprehension, sentences, or spelling instruction** — the game targets
  equivalence recognition of single letters, sounds, words, and pictures only.

---

## Changelog

- 2026-09-22 — GitHub Copilot & Maria Lande — Initial spec authored
