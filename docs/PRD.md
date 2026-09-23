# PRD — Find The Two That Match

|                  |                                                     |
| ---------------- | --------------------------------------------------- |
| **Title**        | Find The Two That Match — Product Requirements Document |
| **Status**       | Active — approved behavior                          |
| **Version**      | 0.2.0                                               |
| **Last updated** | 2026-09-23                                          |
| **Owner/Author** | Maria Lande (with GitHub Copilot)                   |

> This PRD is derived exclusively from two source-of-truth documents:
> `docs/Find-The-Two-That-Match-Spec-Brief.md` (the interaction/product brief)
> and `docs/third-party-game-spec.md` (the delivery container the product must
> run inside). It does not reference the DEVSPEC, UISPEC, or TESTSPEC by
> filename — those documents reference back to this one. It does not describe
> any existing implementation; it specifies the product from scratch.

---

## 1. Product summary

Find The Two That Match is an **offline literacy web game for early readers**
(the brief targets beginner reading skills; no strict age range is given in the
source brief). The screen is split into two sides — a left set of objects and a
right set of objects. Each object on one side has exactly one equivalent
partner on the other side. The learner drags an object across the divide and
releases it near its partner. If the two are equivalent (e.g., lowercase `c`
matched to uppercase `C`), the pair celebrates and the target's audio plays.
If they are not equivalent, a negative sound plays and the dragged object
returns to its original position.

The game is distributed as a **third-party game inside the Curious Reader
container** — an offline-first literacy app that loads the game's `index.html`
from a `file://` URI with no network access. The product must be fully
playable offline and must report completion/usage events through the
container's `cr_event` bridge.

## 2. Goals

- Teach equivalence between paired objects (starting with lowercase/uppercase
  letters; expanding to letter-audio, then words/pictures/rhymes) through a
  drag-and-drop matching interaction.
- Require no reading or written instructions to operate — the interaction
  must be discoverable by a non-reading child through visual/audio feedback
  alone.
- Run identically well fully offline, inside the Curious Reader container's
  `file://` WebView, with zero network calls.
- Let content authors define new matching trials by supplying a JSON file and
  media assets, without code changes.

## 3. Personas

| Persona | Description | Needs |
|---|---|---|
| **Learner** | A child who cannot yet reliably read, ages roughly 4–8 | Simple, forgiving drag interaction; immediate audio/visual feedback; cannot lose progress or be scored against |
| **Content author** | A non-engineer who prepares trial content (object pairs, images, audio, translations) | A documented JSON schema and a predictable media-asset naming convention they can produce without touching game code |
| **Container integrator (Curious Reader team)** | The team that packages, uploads, and ships the game inside the Curious Reader CMS | A game that complies with the third-party game spec's offline rules, ZIP packaging layout, and `cr_event` reporting contract |

## 4. Key user scenarios

1. A learner opens a trial and sees two columns of objects with no on-screen
   text instructions. They pick up an object, see it and a candidate partner
   highlight as they drag it near, and drop it. If correct, they see a
   celebration and hear the target pronounced. If incorrect, the object
   glides back to where they picked it up.
2. A content author authors a new trial JSON file with `left` and `right`
   arrays of objects, each with a `target`, screen `pos`, and `pair_id` list of
   equivalent object IDs, plus image/audio asset paths, and the game loads it
   without any code change.
3. A container integrator installs the game's engine + language ZIPs offline,
   launches `index.html?cr_lang=english&cr_user_id=...`, and observes the game
   fully play through several trials with zero network requests and a
   `cr_event` emitted at least once per completed trial.

## 5. KPIs / success signals

- Loading screen clears and the first trial is playable within 10 seconds
  offline (per third-party-game-spec.md §7b).
- Zero attempted network requests and zero `NETGUARD_BLOCK` log entries during
  a full offline play session.
- 100% of authored object pairs in a trial are matchable by the equivalence
  rule described in the JSON `pair_id` field — no orphaned objects.
- Exactly one well-formed `cr_event` (`user_sessions_data`) and exactly one
  `summary_data` update are emitted per completed trial, with no additional
  emissions per pair or reload.
- A child can complete the MVP letter-matching interaction without needing an
  adult to explain the controls (informal usability signal — not
  automatically measurable, verified via manual test per TESTSPEC).

## 6. Scope tiers (from the source brief)

The brief defines three cumulative implementation tiers. Each later tier
assumes the previous tier's requirements are met.

### MVP
- Split-screen layout; objects placed at JSON-specified positions.
- Starting objects are limited to lowercase and uppercase letters.
- Drag any object; while dragging, if it comes within a defined tolerance of
  another object, both highlight.
- On release: if within tolerance of another object, check equivalence via the
  JSON `pair_id` relationship.
  - Match: celebration animation + audio pronunciation of the target.
  - No match: negative feedback sound + the dragged object animates back to
    its exact pre-drag position.
- An object cannot be dragged off-screen.
- Trial content (both columns, positions, and equivalences) is supplied via a
  JSON input file.

### Better (adds to MVP)
- Audio-only objects can be displayed in the UI (an object with no visible
  glyph, represented for a spoken word/letter).
- Tapping any object plays its pronunciation audio.
- Equivalence checking extends to letter ↔ letter-audio pairs.

### Great (adds to Better)
- Objects can be words, pictures, or rhyming words in addition to letters.
- Equivalence checking extends to word ↔ picture pairs.
- Equivalence checking extends to rhyming-word pairs.

## 7. Non-goals

- No scoring, ranking, leaderboards, or performance grading visible to the
  learner or reported as a competitive metric.
- No user account creation, login, or profile management — identity is
  whatever opaque `cr_user_id` the container supplies.
- No in-game content authoring UI — trial JSON and media assets are prepared
  externally by content authors.
- No multiplayer or networked interaction of any kind.
- No non-drag input modality (e.g., click-to-select-then-click-to-place) is
  required by the source brief; only continuous drag is specified.
- No online/CDN-hosted asset or telemetry path — this product only targets
  the offline Curious Reader container runtime described in
  `docs/third-party-game-spec.md`.

## 8. Milestones (conceptual, not a build order)

1. **M1 — MVP interaction**: letters-only drag-and-match with celebration and
   repel feedback, driven by trial JSON.
2. **M2 — Better interaction**: audio-only objects, tap-to-hear, letter↔audio
   equivalence.
3. **M3 — Great interaction**: words, pictures, rhymes, and their equivalence
   rules.
4. **M4 — Container compliance**: offline runtime compliance, `cr_event`
   reporting, and Curious Reader ZIP packaging, so the product can be uploaded
   and played inside the container end-to-end.

## 9. Constraints inherited from the container

- The product must run from a `file://` origin with no server, no Service
  Worker, and no network calls of any kind at runtime.
- The product must emit usage data only through the `cr_event`
  `postMessage` bridge, never via direct network analytics.
- The product must read `cr_lang` and `cr_user_id` from its launch URL query
  string.
- `cr_lang` selects the language pack; absent or unsupported values fall back
  to English.
- The loading state is textless and the responsive game shell remains within
  the mobile visual viewport without page-level scrolling.
- The product must be packaged as an **engine ZIP** plus **one language ZIP
  per language** (no shared core/book unit is implied by the source brief),
  per the Layout A model in `docs/third-party-game-spec.md` §5.1.

---

## Changelog

2026-09-23 — Maria Lande (with GitHub Copilot) — Approved language fallback, tier support, degraded asset handling, event counts, textless loading, and mobile viewport containment.
2026-09-23 — Maria Lande (with GitHub Copilot) — Initial draft, derived solely from Find-The-Two-That-Match-Spec-Brief.md and third-party-game-spec.md.
