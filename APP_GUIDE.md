# App Guide — [Project Name TBD]

*This is the single source of truth for what the app does and how it's structured.
Written for planning purposes — deliberately excludes tech stack and API choices,
which are decided separately. Accessible Education track, Melbourne Hack 2026.*

---

## 1. What this app is, in one sentence

An early-learning app for preschool-age children with ADHD or autism that builds
lessons out of photos of the child's own real home and toys instead of generic
stock content (Branch 1), and separately helps worried parents of
not-yet-diagnosed children turn a vague concern into a clear question to bring to
a health worker, without ever diagnosing anything itself (Branch 2).

---

## 2. Why two branches, and why they must stay separate

Parents arrive with two very different needs, and merging them into one flow
breaks both:

| | **Branch 1** | **Branch 2** |
|---|---|---|
| Who it's for | Parents of a child **already diagnosed** (ADHD or autism) | Parents of a child **not yet diagnosed**, but something feels off |
| Problem it solves | "We have therapy once a week. What do we do the other six days?" | "Something seems different, but I don't know if it's normal, or who to ask." |
| What it gives | A daily library of stimulation activities, generated from photos of the child's own home | Developmental milestone info + help turning a worry into a clear question card |
| What it does NOT do | Replace a therapist | Diagnose, score, or say "positive/negative" for any condition |
| Where it leads | A daily routine at home | A real-world health worker (e.g. local child health post) via the existing official referral pathway |

**The core rule: the app never asks the parent to declare a diagnosis status to
use it.** Both doors are open to everyone, and a parent can move between them
freely at any time. This is what keeps the app from replicating the stigma it's
trying to help reduce — a parent isn't forced to "admit" anything to get help.

---

## 3. Onboarding (shared entry point, before the two branches split)

Deliberately minimal. Every extra question at this stage is a reason a tired
parent closes the app.

- Child's age (in months) — the only required field
- Nickname — optional
- **No diagnosis question at this stage.** No income, no condition, no
  developmental questions here — those live inside Branch 1 only, for families
  who already know.
- After age is entered: home screen presents **two equal doors** — "I want
  activities for my child" (→ Branch 1) and "I've been thinking about my child's
  development" (→ Branch 2). Neither is presented as the "default" or "more
  serious" option.
- A parent can switch branches at any time, with no conditions attached.

---

## 4. Branch 1 — "My World" (Duniaku)

### 4.1 The core problem this branch solves

Generic activity libraries fail in a specific, common way: the instructions say
"gather colorful blocks," the parent doesn't have colorful blocks, and the
activity never happens. If the activity is instead generated from a photo of
the family's actual home, the "we don't have the right materials" barrier
disappears — because there is no "right materials," only what's already there.

### 4.2 Research grounding (for the pitch, not for engineering)

Two complementary frameworks justify the design, and they don't conflict:

- **NDBI (Naturalistic Developmental Behavioral Interventions)** — includes the
  Early Start Denver Model and Pivotal Response Training. Primary relevance:
  **autism**. Core idea: follow the child's own interests, teach inside natural
  play/routines rather than artificial drills.
- **Task analysis, errorless learning, prompting hierarchy & fading** — special
  education techniques historically used for intellectual/developmental
  disability, and directly applicable to **ADHD** as well (short, clearly
  sequenced steps with a fading support level help with task-initiation and
  follow-through, a core ADHD challenge). Core idea: break a skill into the
  smallest teachable steps, give heavy support at first so the child succeeds
  more than they fail, then reduce support as data shows readiness.

Three findings map directly onto features:

1. **The child's own interests are the mechanism, not a gimmick.** Favorite
   color/toy/character personalization is how these interventions actually
   work, not decoration.
2. **Generalization is the hard problem.** A skill learned in one place/object
   doesn't automatically transfer elsewhere. A generic stock-image "circle"
   doesn't help a child recognize a circle on their own dinner plate. The
   camera/"My World" feature exists specifically to close this gap — content IS
   the child's real environment, so there is no transfer gap to begin with.
3. **The caregiver is part of the intervention, not a bystander.**
   Parent-implemented intervention and visual supports are both
   high-evidence strategies for this population — this validates a
   "caregiver sets up, child uses" model rather than a solo-child app.

### 4.3 Onboarding fields specific to Branch 1

(Shown only after a parent picks Branch 1 — status/condition is never asked
before this point.)

- Condition: ADHD or Autism (swappable field, not locked — see Section 7 on
  modularity for why this matters for future conditions)
- Communication level (simple, caregiver-facing description, not a formal
  assessment)
- **Developmental level, not just age** — what can the child already do right
  now (points to objects? uses single words? matches colors?) rather than
  assuming ability from age alone. Teaching to developmental level rather than
  chronological age is better supported for skill acquisition and
  generalization.
- Favorite color / animal / character type — becomes the visual theme and
  reward motif throughout the app
- Sensory profile: sound on/off, animation intensity, color saturation
- Whole onboarding stays under two minutes, with "skip for now" available on
  every field

### 4.4 The "My World" capture flow

1. Parent chooses a context: home / yard / a new place they're preparing to
   visit
2. Parent chooses whether to use a photo, or skip to generic age-appropriate
   activities if they'd rather not use a photo right now
3. If photo: parent selects a photo of the room from their device (taken on a
   phone, uploaded from the laptop — the app does not operate the camera)
4. **Any faces in the photo are automatically blurred on the device, before the
   photo goes anywhere else** — this is not optional, it does not depend on the
   parent remembering, and it happens locally, so an unblurred face is never
   transmitted
5. The redacted photo is sent to the recognition service, which identifies the
   real objects present. The system then breaks a relevant skill into small
   teachable steps (task analysis) suited to the objects found and the child's
   condition/level
6. **The photo is sent only for the moment of processing and is never stored** —
   not by the app, not on the device, not after the response comes back. Only
   the resulting activity content is kept.
7. The parent is shown 3–5 candidate activities, each with a suggested
   starting support level based on what's known about the child's skill so far
8. Parent picks one activity to run with their child

### 4.5 Running an activity: the support-level ladder

This is the mechanism that makes the app adaptive over time, and it applies
identically to whichever game (see Section 6) the activity is delivered
through.

Support levels, from most to least help (the "prompting hierarchy"):

1. **Full physical support** — caregiver physically guides the child's hands
2. **Partial physical support** — lighter physical guidance
3. **Gesture/pointing only** — caregiver points, doesn't touch
4. **Verbal only** — caregiver describes what to do, no physical or gesture cue
5. **Independent** — child does it unprompted

Flow for a single activity session:

1. Step-by-step instructions are shown, including *how* to give physical,
   gesture, or verbal support at the currently suggested level (errorless
   learning: give generous support early so the child succeeds more than they
   fail — confidence is built first, support is faded later, not the reverse)
2. After the activity, the parent logs how much support was actually needed
   this time (not "did they enjoy it," specifically the support level used)
3. **Fading logic**: the system tracks support level needed per skill over
   multiple sessions. A consistent pattern of needing less support triggers a
   suggestion to try a lower support level next time. This is a genuine
   adaptive loop, not a one-shot recommendation.
4. **Generalization testing**: once a skill is mastered independently in one
   context (e.g. the kitchen), the system deliberately re-introduces the same
   skill in a *new* context (a new room, a different object) rather than
   assuming one success means the skill is permanently learned. A drop back to
   needing more support in the new context is never flagged as regression —
   it's an expected, logged part of generalization, and support fades again
   from there, typically faster than the first time.
5. History (support level per skill per context, over time) is summarized for
   an external therapist/professional, if the parent chooses to export it —
   never presented as a score or a conclusion. The professional interprets it,
   not the app.

### 4.6 Preparing a child for a new place (social story sub-flow)

Separate, narrower flow: showing a child photos of a new place *before* they
go there is a well-supported way to reduce transition anxiety, particularly
for autistic children (the "social story" format — real photo of the actual
place + short, age-appropriate sentences, e.g. "Tomorrow we go here. This is
the door. This is where we put our shoes.").

- Parent supplies a photo of the new place (school, clinic, a relative's
  home), selected from their device
- Mandatory checkpoint before proceeding: confirm no other children are
  visible in the photo, and that permission was given by whoever manages the
  location
- System generates short, age-appropriate sentences matched to what's actually
  visible in the photo
- Result is a simple picture book shown to the child repeatedly in the days
  before the visit
- **This is the only place in the entire app where the child looks at a
  screen at all** — every other flow has the child interacting with the real
  room/objects, not a photo of them. It's brief, caregiver-accompanied, and
  purpose-specific.

### 4.7 Caregiver dashboard

- Plain-language session recap ("12 minutes, 3 activities, 2 movement breaks.
  Longest focus stretch: 4 minutes.")
- **Focus-stretch trend** — longest sustained attention per session over time;
  the specific metric ADHD caregivers care about most
- "What worked today" — which activity types held attention longest
- **Generalization tracker** — which real-world objects/skills the child has
  successfully generalized to independence, across which contexts. Only
  possible because content comes from the child's real environment.
- One-page export summary suitable for a therapist or educator to glance at
- Explicit non-diagnostic banner shown on the dashboard at all times: "This is
  an activity log, not a clinical assessment."

### 4.8 Cross-cutting requirements for Branch 1

- **Face blurring happens on the device, before any photo is transmitted.** The
  redacted photo is then sent for processing and **is never stored** — not by
  the app, not by the device, not after the response returns. Nothing is
  retained but the activity content that comes out. Stated clearly in the pitch
  in exactly those terms: *photos are sent only for the moment of processing and
  are never stored* — not as an on-device or never-leaves-the-device claim,
  which would not be true
- Generating content requires a connection. **Once content for a session is
  generated, the session itself can run without an internet connection** — the
  network is needed to create an activity, never to run one
- Child-facing UI is icon- and audio-only — no text required to use it
- No-fail design: no red X, no wrong-answer buzzer, no numeric score visible
  to the child; every attempt receives specific positive reinforcement (naming
  the effort, not just the outcome)
- The app periodically prompts the caregiver to join in directly ("ask them to
  show you the red one!") — reinforcing that this is a tool that supports
  real adult-child interaction, not a replacement for it

---

## 5. Branch 2 — From worry to question

### 5.1 The core problem this branch solves

A parent notices something that makes them uneasy but has no path forward:
they don't know if it's within a normal range for the child's age, they don't
know who to ask, and they're often carrying conflicting advice from family
("don't worry, they'll grow out of it"). This branch does not try to answer
"is something wrong" — it exists to turn a vague, emotional worry into a
specific, answerable question, and to connect the parent to the real people
whose job it is to answer it.

### 5.2 Why this branch deliberately does NOT screen or score

The best validated screening tool in the world for autism (M-CHAT-R/F) is only
correct about 58% of the time when it flags a positive result, and roughly a
quarter of children who screen "clear" are later diagnosed anyway. If a
clinically validated tool has error rates that large, a tool built during a
hackathon has no business presenting anything that resembles a screening
result to a parent. So this branch deliberately does not compete with
official developmental screening — it exists purely to help a parent get to
the people who administer that screening, faster and with a clearer question.

### 5.3 Flow

1. Parent reads general developmental milestone information, presented as
   narrative, not a yes/no checklist
2. Parent is asked: is there anything here that's been on your mind?
   - If no → the flow simply ends. No score, no result, nothing is recorded
     as a "finding."
   - If yes → continue
3. Parent describes the concern in their own words — typed, however it comes
   out, including mixed-in emotion or other people's comments. (Spoken input is
   a roadmap item, not in this build: the browser speech APIs send audio to the
   browser vendor, and a parent's voice describing a worry about their child is
   the last thing that should travel by default. Typed input is the whole
   surface for now.)
4. The concern is restructured into a clear, specific, answerable observation
   — stripped of diagnostic language, risk framing, or words like "delayed."
   The output is a question a health worker can actually respond to, built
   only from what the parent actually observed.
5. The resulting question card can be printed or saved, along with
   information on the nearest local child-health service and its schedule
6. The parent decides what happens next:
   - Bring the card in → the health worker/local early-detection pathway
     takes over from there — this app's role ends at the handoff
   - Not ready yet → the card stays saved on the device, reopenable any time
7. Immediately after the card is created, the parent is offered a relevant
   activity (bridging back to Branch 1) — leaving a parent newly aware of a
   concern with nothing they can actually do in the meantime is the single
   worst outcome this branch could produce, so it's avoided by design

### 5.4 Example transformation (illustrates the tone, not literal copy)

**What a parent might write:** "My child is 20 months and still hasn't said
'mama' directed at me, just babbles to themselves. A neighbor said not to
worry, they'll talk eventually."

**What the resulting card looks like:**
> To ask your health worker: My child is 20 months old. They have not yet
> said a word directed at another person, though they frequently vocalize on
> their own.
> 1. Is this within a typical range for this age?
> 2. What should I watch for over the next few months?
> 3. Would a developmental check be worth scheduling?

Notice what's deliberately absent: no suspected condition, no risk level, no
word like "delayed." Only the parent's own observation, cleaned up into a
question the health worker can directly respond to.

---

## 6. How the two branches connect

This is the most failure-prone part of the design, so the rules are explicit.

**From Branch 1 into Branch 2.** If a parent repeatedly marks "didn't want to
/ couldn't do it" for activities in the same skill domain, the system does
**not** raise a warning, does not compute anything, and does not draw any
conclusion. The only thing that appears is the same neutral prompt available
everywhere in the app: "Want to save a note about this to ask about later?"
Without this restraint, the activity history would slowly turn into a
disguised screening tool — which directly contradicts this app's own
principles.

**From Branch 2 into Branch 1.** Once a question card is created, the parent
is immediately offered a relevant activity. Making a parent aware that
something might be worth asking about, and then leaving them with nothing to
actually do, is the most effective way to produce anxiety with no benefit
attached — so the branches always hand back to each other, never leave a
parent stranded.

---

## 7. Modular game architecture for Branch 1 (important for planning)

The app must be built so that **the underlying engine is shared, and
individual games are interchangeable modules on top of it** — not five
separate, hand-built pipelines. This is the single most important structural
decision for the build plan.

### 7.1 What's shared across every game (build once)

- The "My World" photo-intake → on-device face-blur → object recognition →
  discard-photo pipeline (in that order — the blur is always first, and always
  local)
- The condition profile (ADHD or Autism for now, but the field itself is
  generic and not hardcoded to only these two — see 7.3)
- The developmental-level and sensory-profile settings
- The support-level ladder (full physical → partial physical → gesture →
  verbal → independent) and its fading logic
- The generalization re-testing logic (same skill, new context)
- The no-fail / positive-reinforcement feedback model
- The caregiver dashboard and its metrics (session recap, focus-stretch
  trend, generalization tracker)

### 7.2 What's specific to each game (a thin layer on top of the shared engine)

Each game is defined by: what skill it targets, what interaction shape it
uses, and how it renders a "step" — everything else (support level, fading,
generalization, logging, reward) comes from the shared engine automatically.

**Game 1 — "Find it in your world" (scavenger hunt).** The app names a target
(an object, a color, a category), the child goes and finds the matching real
object in their actual room, and the caregiver uploads a photo of what the child
found; the app confirms and celebrates. This is the primary
generalization-training game, and the clearest live-demo moment because it's
instantly legible to an observer. The caregiver is in the loop by construction
here — consistent with Section 4.2's third finding — and the confirmation step
needs a connection (see Section 4.8).

**Game 2 — My-toy story sequencing.** Uses photos of the child's own toys to
build a short sequence (e.g. three steps of a simple routine, like a toy
"waking up," "eating," "sleeping"). Targets ordering and simple narrative
structure using personally meaningful objects rather than generic sequencing
cards.

**Game 5 — Trace-and-match.** Starting from a photo of a real object owned by
the child, the child traces or matches its outline. Combines fine-motor
practice with personally relevant content instead of a generic stock shape.

### 7.3 Why this matters for future extension

Because condition, support level, sensory settings, and the object-recognition
pipeline are all handled once at the engine level, adding a **new game**
later only requires defining its target skill and interaction shape — it does
not require rebuilding fading logic, generalization testing, or the
dashboard. Likewise, adding a **new condition** later (e.g. speech delay, as
discussed but deferred) only requires defining how that condition tunes
pacing/sensory/step-size defaults — not a new engine. For the current build,
only ADHD and Autism are implemented as condition profiles, and only Games 1,
2, and 5 are implemented — but nothing in the architecture should assume
these are the only ones that will ever exist.

### 7.4 How condition affects a game, concretely

The three built games behave identically in structure for both conditions —
same target skill, same support ladder, same generalization logic. What
changes per condition is tuning, not the game itself:

- **Autism**: literal, concrete language in every instruction; predictable,
  unsurprising sequencing; sensory settings default toward lower stimulation;
  no time pressure
- **ADHD**: shorter reps per attempt; more frequent movement breaks inserted
  between attempts; faster positive feedback after each success; the
  frustration/disengagement heuristic (see 7.5) is weighted more heavily
  toward triggering a break

### 7.5 Frustration/disengagement handling (shared across all games)

The engine watches for *behavioral* signals, not emotional ones — time to
first interaction, rapid/random tapping, no input for an extended period.
When detected, it triggers either a movement break or a switch to an easier
step of the current skill, rather than pushing the child to continue
struggling. This is deliberately simple and rule-based, not a claim about
reading the child's emotional state.

---

## 8. What this app deliberately never does (both branches)

Stated explicitly because it's as important as the feature list, and it's
what prevents the app from becoming the kind of tool it's trying to be an
alternative to:

- Never scores or grades a child's development
- Never analyzes a child's face, expression, or behavior from photo or video,
  and never asks for a photo of the child themselves at all
- Never predicts or suggests a diagnosis, at any confidence level
- Never judges the quality of a home or the quality of parenting — output is
  always "here's something you can do with what you already have," never a
  score, a judgment, or a suggestion to go buy something
- Never attempts to detect hazards in the home (e.g. an open power outlet) —
  this sounds useful but sits in a domain of judgment and liability the app
  has no business claiming
- Never stores a photo, anywhere, at any point — photos are transmitted for the
  moment of processing and are retained by nothing afterwards
- Never transmits an unblurred face. Blurring is local and happens before
  anything is sent, so a face is not merely unanalysed — it never leaves the
  device in the first place
- Never shares anything with a third party for any purpose other than producing
  the content the parent just asked for. Activity history, support-level logs,
  and question cards stay on the device, and leave it only when the parent
  themselves chooses to export or show them, on a per-instance basis

---

## 9. Data handling (both branches)

| Data | Handling |
|---|---|
| Room/environment photos | Faces auto-blurred **on the device first** → redacted photo sent for the moment of processing → **never stored**, by the app or anyone else, once the response returns |
| Faces | Never transmitted. Blurring is local and precedes any send, so no unblurred face leaves the device at all |
| Concern text (Branch 2) | Sent for the moment of rewriting into a question card → **never stored** off the device. The resulting card is saved locally |
| Child's age | Stays on device |
| Activity history / support-level logs | Stay on device. Never transmitted |
| Question cards (Branch 2) | Stay on device; only leave the device if the parent themselves brings, prints, or shows it to someone |
| Sharing with any third party | Nothing is ever shared for any purpose beyond producing the content the parent just asked for. No advertising, no analytics, no training, no profile-building — and no automatic sharing of history or cards, ever |

**How to say this accurately**: *"Photos are sent only for the moment of
processing and are never stored."* Do **not** say "on-device" or "never leaves
your device" about the photo — those were true of an earlier design and are not
true of this one. What *is* true on-device, and worth saying: **the face blur**,
and **everything the app remembers**.

---

## 10. Demo scope discipline

- **One condition fully demoed end-to-end** — pick either ADHD or Autism as
  the single condition shown in the live demo; the other remains selectable
  and functional but doesn't need to be the star of the pitch
- **All three games (1, 2, 5) working end-to-end** for the demo condition,
  sharing the same engine as described in Section 7
- Pre-capture the "My World" photo library before the demo so lighting/setup
  isn't a live risk on stage, but **upload at least one photo live during the
  demo** — a photo the audience can see was not part of the prepared set — to
  prove the pipeline is real, not staged. The app takes photos by file upload,
  not by operating a camera, so the live moment is a picker and a result, not a
  viewfinder
- The demo depends on a working connection for the recognition step. **Rehearse
  a fallback**: a pre-generated session that runs entirely offline, so a bad
  venue network costs the recognition moment rather than the whole demo
- Branch 1 is the primary demo (a room photo turning into activities in
  seconds is a strong, fast, visual moment); Branch 2 is built and working,
  but framed in the pitch primarily as the impact/reach argument rather than
  the centerpiece of the live demo
- Use only fictional or team-member data in the build and video — never a
  real child's photo or profile
- Never claim therapeutic outcomes. Frame everything as "designed on
  principles from NDBI and special-education research," never "clinically
  proven"
- **Get the privacy claim exactly right in the pitch.** The accurate line is
  *"photos are sent only for the moment of processing and are never stored,"*
  paired with *"faces are blurred on the device before anything is sent."*
  Overclaiming here — saying "on-device" or "never leaves your device" — would
  be the single most damaging factual error the pitch could contain, and it is
  an easy one to make by habit

---

## 11. Open decisions for the team (not yet locked)

1. Which condition (ADHD or Autism) gets the full live demo
2. Project name
3. Age range to explicitly support/state (0–6 is the broad real-world range
   for the equivalent official early-detection framework; narrowing this for
   the prototype's stated content may be sensible)
4. Whether to attempt a brief conversation with an early-childhood educator
   or occupational therapist before build — even 15 minutes materially
   strengthens the Feasibility/Impact story in the pitch
5. Whether Branch 2's local-referral information will use real, verifiable
   local service info for the demo region, or clearly-marked placeholder
   data
