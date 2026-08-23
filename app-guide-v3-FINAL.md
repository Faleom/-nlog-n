# App Guide v3 — [Project Name TBD]

*Melbourne Hack 2026 · Accessible Education track · SDG 4*

**Single source of truth.** Supersedes App Guide v1, v2, Addendum A and Addendum B — all superseded decisions are resolved to their final state below. Nothing here defers to another document.

*Excludes tech stack and API choices except where they constrain design.*
*Submission: Monday 24 August, 11:59pm AEST via Devpost.*

---

## Contents

| § | Section |
|---|---|
| 0 | Decisions closed |
| 1 | What this is |
| 2 | Who it's for |
| 3 | Two branches |
| 4 | Platform: tablet and phone |
| 5 | Onboarding |
| 6 | The Child Context Profile |
| 7 | Branch 1 — My World |
| 8 | The three games |
| 9 | Branch 2 — Worry to question |
| 10 | How the branches connect |
| 11 | Failure and degradation |
| 12 | Architecture |
| 13 | What this never does |
| 14 | Data handling |
| 15 | Regional framing |
| 16 | Build scope — Option A and the fallback |
| 17 | Build order |
| 18 | Demo discipline |
| 19 | Rubric mapping |
| 20 | Submission checklist |
| 21 | Open decisions |
| — | Appendix: evidence and Q&A |

---

## 0. Decisions closed

Do not reopen before submission.

| Decision | Locked value | Why |
|---|---|---|
| **Age band** | **3–5 years** | Below ~18 months the AAP advises no screens at all, and symbolic representation (photo → real object) hasn't developed — that is our entire mechanism. Above 6, formal reading instruction starts and a zero-text UI stops being an accessibility feature |
| **Platform** | **Tablet and phone only, touch** | The device travels with the child. Preschoolers are touch-native and mouse-illiterate. This is the device families already own |
| **Phone support** | **Full feature parity** | Different layout patterns, identical capability. No game, level or feature is tablet-only |
| **Diagnosis** | **Never required, optionally declared** | Profiling runs on four response questions. A declaration only pre-fills them and gates nothing |
| **Demo profile** | **One response profile end-to-end** | Autism-leaning defaults (calm, sameness, minimal words) as the demo configuration |
| **Primary demo** | **Branch 1, Game 1** | A room photo becoming activities in seconds is the fastest legible visual moment available |
| **Branch 2 in demo** | **Walkthrough, hardcoded example** | Built and working, framed as the impact and reach argument |
| **Game 3** | **Three alternating modes** | Shadow Match, Trace, Puzzle over one engine |
| **Branch 2 input** | **Guided prompts** | Voice as roadmap. Typing a paragraph on a phone at 11pm is an abandonment risk |
| **Build scope** | **Option A, with Option B as a zero-cost fallback** | See §16 |
| **Region framing** | **Stated explicitly in the pitch** | See §15 |

**Game numbering fixed.** Earlier drafts listed Games 1, 2 and 5. They are Games 1, 2 and 3. There is no gap.

---

## 1. What this is

An educational activity app for **children aged 3–5 who are autistic, have ADHD, or are still waiting on a diagnosis**. Two doors:

**Branch 1 — "My World."** The parent photographs their own living room; the app identifies what's actually in it and generates learning activities using those objects. No materials barrier, because there is no "right materials."

**Branch 2 — Worry to question.** For parents who aren't sure anything is wrong. Turns a vague worry into a clear question they can hand to a health worker. Never screens, scores, or suggests a diagnosis.

**One-line pitch:**

> *Most early-learning tools teach with stock content and assume the child can read a prompt or say an answer. We teach with the child's own room, their own toys, their own things — and we require neither reading nor speech.*

**An important framing note.** Three games sit inside this app, but **the child spends most of a session away from the screen**, in the room, with real objects. The screen is where a caregiver sets up and where the child confirms. Never describe the whole product as "a game" — that framing throws away one of your strongest answers on screen time.

---

## 2. Who it's for

State the user by **capability, not diagnosis**.

> **Who:** Children aged 3–5 who are **pre-literate and pre- or minimally verbal** — they can't read instructions and can't reliably speak answers.
>
> **Barrier:** Early-learning content assumes the child can read a prompt or speak an answer. These children can do neither, so they're locked out of the digital learning their peers get — and the generic stock content in what remains doesn't transfer to their real environment.

**Why this framing wins:**

- It captures autistic preschoolers, ADHD preschoolers and speech-delayed preschoolers without requiring a label
- ADHD median diagnosis is 6 (moderate) to 7 (mild); autism median is ~47 months. At 3–5, **most children who will eventually be diagnosed have no diagnosis yet.** A diagnosis-gated product excludes the families who need it most
- The child never has to speak → we never have to score speech → the single largest technical risk disappears by design
- Maps onto two of the track's named barrier categories: *cognitive and learning differences* and *language and literacy*

**Say it this way in the pitch:** *"Built for autistic and ADHD preschoolers — including the ones still on a waiting list."*

**Q&A:** *"Is this for autism or ADHD?"* → *Neither, and that's the point. It's for pre-verbal, pre-literate preschoolers. Diagnosis is irrelevant to whether it works — which matters, because diagnosis is usually delayed.*

---

## 3. Two branches, and why they stay separate

Parents arrive with two very different needs. Merging them breaks both.

| | **Branch 1 — My World** | **Branch 2 — Worry to Question** |
|---|---|---|
| **Who** | Parents wanting activities for their child | Parents who aren't sure anything is wrong |
| **Problem** | "Therapy is once a week. What do we do the other six days?" | "Something seems different, but I don't know if it's normal, or who to ask." |
| **Gives** | A daily library of activities generated from photos of the child's own home | Milestone info + help turning a worry into a clear question card |
| **Does NOT do** | Replace a therapist | Diagnose, score, or say positive/negative for anything |
| **Leads to** | A daily routine at home | A real health worker, via the existing official referral pathway |

**The core rule:** the app never requires a parent to declare a diagnosis status to use it. Both doors open to everyone; a parent switches freely at any time. This is what stops the app replicating the stigma it exists to reduce.

---

## 4. Platform — tablet and phone

### 4.1 Why touch, and how to say it

Not a technical preference — a consequence of who the user is:

- **The device travels with the child.** The product is built around a child moving through a real room and coming back. A laptop is furniture; a tablet or phone goes where they go
- **Preschoolers are touch-native and mouse-illiterate.** A 4-year-old with fine-motor differences cannot operate a trackpad. Direct touch is the only viable model at this age
- **It's the device families have.** Tablets are the standard early-intervention delivery device — the TOBY trial ran on iPads
- **Large touch targets are a track requirement:** *fewer screens, larger touch targets, clear audio cues*

> **Pitch line:** *"We built for the device families already hand their kids — and the one a four-year-old can actually operate."*

### 4.2 The camera is native

Parent points the device at the room and shoots. No file picker, no desktop file system — a genuine usability barrier removed for the exact demographic the track guidance describes (tired parents, low digital literacy assumed by default).

**This also makes the demo far stronger:** pick up the device, photograph the room the judges are sitting in, get activities back in seconds. Proves the pipeline is real rather than staged.

### 4.3 Phone gets full parity

Nothing here needs a large screen — the child is looking at the room, not the display. The screen shows one prompt and a confirmation moment.

The constraint is real (a phone has ~⅓ the area, and 88×88pt touch targets are non-negotiable), so the answer is **change the layout pattern, never shrink the target**:

| Pattern | Tablet | Phone |
|---|---|---|
| **Grid → Carousel** | 6 crops, 3×2 grid | 6 crops, swipeable row, 2.5 visible |
| **Grid → Sequential reveal** | 4 options at once | 2 at a time, "show me more" between |
| **Side-by-side → Stacked** | Sample above a row | Sample pinned top, options scroll beneath |
| **Sequence row → Vertical strip** | 4 steps left to right | 4 steps top to bottom |
| **Dashboard columns → Accordion** | Three panels | Collapsible, recap open by default |

Defaults: carousel for Game 1 confirmation, sequential reveal for Game 3 options, vertical strip for Game 2.

**Fixed on both devices:** 88×88pt minimum touch target · same audio, prompts and pacing · same difficulty ceiling. **Phone locks to portrait** — rotation mid-session is a disruption, especially for a child who needs predictability.

**The rule to say out loud:** *"We cap the grid on phones rather than shrinking the buttons."* Specific, credible, and most teams wouldn't think to make it.

**One genuine phone advantage:** a phone is in a pocket; a tablet gets left on a table. Branch 2 in particular — a worried parent late at night — is almost exclusively a phone use case.

> *"It works on whatever's in the parent's hand — and for the parent who's worried at 11pm, that's a phone."*

### 4.4 Platform costs

| Cost | Handling |
|---|---|
| **On-device face blur on mobile** | Downscale to ≤1024px, detect on the downscaled image, map boxes back, blur at full res. Budget half a day. **Fallback if not working by Saturday night: a hard "no people in frame" confirmation gate.** Never ship an unblurred pipeline |
| **Camera permission denied** | Both branches stay fully usable. Branch 1 falls back to generic activities. Camera is an enhancement, not a gate |
| **Large photo files** | Downscale before transmission — nothing above 1024px on the long edge needs to reach the vision model |
| **No keyboard for Branch 2** | Guided prompts instead of free text — see §9.3 |
| **Hover states** | There is no hover on touch. Anything relying on it silently breaks — remove all of it |
| **Touch feedback** | Immediate visual response on every press. Preschoolers press again if nothing happens, which the disengagement heuristic would misread as rapid random tapping |
| **Accidental exits** | Session end requires a deliberate caregiver action, never a stray swipe |
| **Testing** | One real tablet and one real phone. Devtools emulation is not sufficient for touch-target sizing |

---

## 5. Onboarding

Deliberately minimal. Every extra question is a reason a tired parent closes the app. **Whole flow under two minutes, "skip for now" on everything.**

### 5.1 Shared entry (before the branches split)

- **Child's age in months** — the only required field
- **Nickname** — optional
- Then: **two equal doors** — *"I want activities for my child"* (→ Branch 1) and *"I've been thinking about my child's development"* (→ Branch 2). Neither styled as default or as the more serious option
- Switching branches later is unconditional

### 5.2 Response profile (Branch 1, four questions)

**There is no condition field.** The tuning that used to key off "Autism" or "ADHD" now keys off what the parent actually observes — which is more accurate anyway, because two autistic children can need opposite settings.

> **"How does your child do best?"** — *Four questions. Skip any. Change them any time.*

| # | Question | Options | Tunes |
|---|---|---|---|
| 1 | How does your child handle sound and movement on a screen? | Calm and quiet · Doesn't mind · Likes it lively | Audio, animation intensity, colour saturation |
| 2 | How long does your child usually stay with one thing? | A minute or two · A few minutes · Quite a while | Session length, reps per attempt, movement-break frequency |
| 3 | Does your child do better when things happen the same way every time? | Sameness helps a lot · Somewhat · They like variety | Sequence predictability, layout stability, phrasing consistency, Game 3 mode rotation |
| 4 | How does your child let you know what they want? | Not with words yet · Single words · Short phrases · Full sentences | Prompt complexity, instruction length, starting support tier |

**Mapping to the old profiles** — the tuning tables survive, they're just produced by answers instead of a label:

| Old profile | Now produced by |
|---|---|
| Autism tuning — literal language, predictable sequencing, low stimulation, no time pressure | Q1 *calm* + Q3 *sameness helps* + Q4 *not with words yet / single words* |
| ADHD tuning — shorter reps, frequent breaks, fast feedback | Q2 *a minute or two* + Q1 *likes it lively* |

> **Pitch line:** *"A diagnosis of autism tells you almost nothing about whether this particular child wants the sound on. We ask the four things that actually change how the app behaves — and a parent doesn't need a diagnosis, or a referral, or a two-year waiting list, to answer them."*

### 5.3 The optional declaration

Parents **may** tell the app their child's diagnosis. They are **never required to**, and nothing is gated on it.

- Onboarding shows one optional line: *"If your child has a diagnosis and you'd like to tell us, you can — but you don't have to, and nothing changes if you skip it."*
- If answered, it **pre-fills the four response questions** with sensible defaults, saving taps for a parent who already knows their child's profile
- Every pre-filled answer remains visible and changeable
- **The engine reads the response profile only.** The declaration never reaches the tuning logic directly
- Nothing is scored, no label is displayed back, and the word never appears in child-facing content

**Q&A:** *"You can tell us if you want. It saves you four taps. It doesn't unlock anything, because nothing should be locked behind a diagnosis a family may be two years away from getting."*

### 5.4 Keeping it from feeling like an assessment

The response questions must read as preferences a parent already knows, not as items producing a result.

- No scoring, no summary screen, no profile-type name shown back
- Answers never displayed as a cluster or label
- Wording stays observational (*"how does your child let you know what they want?"*) not evaluative (*"can your child speak in sentences?"*)
- Every question skippable, every answer changeable, no completion percentage

---

## 6. The Child Context Profile

> **This is the differentiator.** The child's favourite things aren't the theme — they're the content.

### 6.1 Why this is research, not decoration

Say this explicitly, because it's the difference between "cute personalisation" and "the actual mechanism":

- NDBI's core principle is **following the child's lead** — using each child's preferred interests and stimuli to create learning opportunities rather than extrinsic artificial reinforcers. Preference isn't a skin on the teaching; it *is* the teaching
- **Extrinsic rewards don't generalize.** A child learns to perform for the star, not the thing. When the reward is their own teddy appearing, reward and content are the same object — nothing to fade
- **Motivation is the adherence lever.** Families stop using these apps (§7.2). A child who asks to play because their teddy is in it is a different retention curve

> **Pitch line:** *"Other apps personalise the theme. We personalise the content. The child isn't learning about a cartoon bear — they're learning with their bear."*

### 6.2 What gets captured

One-time at onboarding, editable any time, everything skippable.

**Layer 1 — The Companion (the anchor)**

One favourite toy or comfort object, **photographed and named**:
- Parent photographs the toy on its own
- Parent types or speaks its name — *"Bunbun," "Big Ted," "Choo-choo"*
- Parent picks a pronoun: he / she / they / it

**Layer 2 — Quick preferences (tap-only, ~30s)**

| Field | Input | Used for |
|---|---|---|
| Favourite colour | Swatches | UI accent, reward motif, Game 1 colour targets prioritised |
| Favourite animal | Icon picker | Story characters, movement prompts (*"hop like a rabbit!"*) |
| Favourite food | Icon picker | Story content, category prompts (*"find something you eat"*) |
| Favourite place at home | Text or tap | Where sessions are suggested, story settings |
| Favourite sound | Short list | Success chime, session-start cue |
| Motivating movement | jump / spin / stomp / clap / splash | Movement-break content |

**Layer 3 — People and routine (~30s)**

- **Who's at home** — the terms the child uses (*"Mama," "Dada," "Kakak," "Nana"*)
- **Two routine anchors** — bath time, bedtime, snack, getting dressed, going out. These become Game 2 sequence templates, so sequences are the child's *real* routine

**Layer 4 — The Avoid List ⭐**

> **"Anything we should stay away from?"**

Multi-select plus free text: loud or sudden sounds · fast animation or flashing · a specific colour they dislike · specific words or topics that upset them · surprises and unannounced changes.

**Everything listed is hard-excluded from all generated content**, engine-level, no exceptions.

Worth calling out in the pitch: almost every personalisation feature in edtech captures what a child *likes*. Capturing what to **avoid** is the accessibility-literate move, and for autistic children it's often the more consequential list. It demos in five seconds — add "loud sounds" and the success chime silently becomes a visual pulse.

### 6.3 The Companion mechanic

The single strongest feature in the product. The child's own toy becomes the app's character.

| Role | Behaviour |
|---|---|
| **Guide** | All instructional audio is framed as coming from them — *"Bunbun wants to find something red!"* rather than a disembodied app voice |
| **Protagonist** | Game 2 stories star them by name, using their photo |
| **Target** | Game 1 can ask the child to find them — the highest-motivation target available |
| **Reward** | Their photo appears on success, framed in the child's favourite colour |
| **Helper who needs help** | *"Bunbun can't reach the blue ball — can you get it?"* Prosocial framing, and a well-established motivational structure in early intervention |
| **Session bookend** | Greets at start, waves goodbye with the off-screen handoff — *"Bunbun says go find your red cup with Dada!"* |

**Why this is unusually strong for a hackathon:**

- **Zero art budget.** The character is a photo the parent took. You ship a fully-charactered app with no illustrator
- **Structurally impossible for competitors.** Any app with a licensed or drawn mascot has a fixed character. Yours is different for every child by construction
- **Demos in one swap.** Change the Companion in settings and the whole app visibly changes — same code, different child. A four-second moment that proves the architecture
- **It's the generalization argument made emotional.** Their actual teddy, in the app, asking them to find things in their actual room

**Guardrails:**

- The Companion is an object, never a person. **No photos of people, ever** — enforced by the same face-detection gate as room capture. If a face is detected the photo is rejected: *"Let's use a toy or object instead."*
- The Companion never gives instructions the caregiver hasn't seen — the caregiver screen always shows what's being said
- The Companion is never sad, disappointed, or hurt by a wrong answer. Exactly two states: waiting and delighted

### 6.4 The slot system

Every generated string is a template with typed slots the engine fills from the profile:

```
{companion}        → "Bunbun"
{companion_they}   → "he" / "she" / "they" / "it"
{fav_colour}       → "red"
{fav_animal}       → "rabbit"
{fav_food}         → "banana"
{fav_place}        → "the kitchen"
{caregiver}        → "Dada"
{child}            → "Maya"
{movement}         → "hop"
{object.name}      → from the room photo, e.g. "red cup"
```

**Every audio line, prompt, story sentence and reward message is authored with slots.** The engine never emits a generic string when a slot is available.

**Avoid-list filtering runs last**, on the final filled output. If any avoided term or property survives, the line is swapped for its neutral variant.

**Implementation note:** lookup-and-substitute, not model generation at runtime. Templates hand-written, slots filled deterministically. Always works, instant, free — and the personalisation cannot hallucinate.

### 6.5 Keeping preferences current

Favourites change fast, and stale personalisation is worse than none.

- After 10 sessions, one caregiver-screen question: *"Is {companion} still the favourite?"* — change or keep, one tap
- The dashboard shows which context items drive engagement (*"prompts featuring Bunbun held attention 40% longer"*)
- Everything editable from one settings screen. No re-onboarding

### 6.6 Onboarding length risk

The Context Profile adds length, and the two-minute cap exists because exhausted caregivers abandon long forms.

**Mitigations:** everything skippable; the Companion photo is the only thing worth pushing for, and even it has a "skip for now" falling back to a neutral guide; quick preferences are tap-only with no typing; the avoid list defaults to empty; the app can ask for the rest later, once the parent has seen it work.

> **Design rule: onboarding asks for the Companion. Everything else is offered, never required.**

---

## 7. Branch 1 — My World

### 7.1 The core problem

Generic activity libraries fail in a specific, common way: the instructions say *"gather colourful blocks,"* the parent doesn't have colourful blocks, and the activity never happens.

Generate the activity from a photo of the family's actual home and that barrier disappears — because there is no "right materials," only what's already there.

### 7.2 The adherence problem — our headline Impact claim

**TOBY Playpad** (Telethon Kids Institute / Monash, RCT 2017) delivered early behavioural intervention to autistic preschoolers via iPad with parents as co-therapists — very close to Branch 1.

- **No group difference on the primary outcome** (ATEC) at 3 or 6 months
- **Significant 6-month gains on three secondary outcomes:** Mullen Fine Motor, Mullen Visual Reception, total words understood
- **The finding that matters:** *sustained use over the full six months was a challenge for most families*, with drop-off after roughly three months. 70% of carers still called it a helpful therapy planning tool

**Read it correctly: the pedagogy wasn't the failure point — adherence was.**

> *"App-based early intervention has been trialled in Australia and it works when families use it. Families stop within three months. We designed for the drop-off, not the demo."*

**Three design consequences, all cheap:**

1. **The session cap.** 12 minutes for session 1, −1 minute per session, floor 6. The app ends itself
2. **The fade.** Sessions get *shorter* over time and push progressively more activity off-screen. An app whose success condition is being used less
3. **The off-screen handoff.** Every session ends by naming a real object from that session and handing the family an offline activity with it

**This also turns screen time into a strength.** The AAP's 2026 guidance replaced hard limits with the **5 C's** — Child, Content, Calm, Crowding Out, Communication. Two are directly ours: *Crowding Out* (we replace nothing — we hand back to real play) and *Communication* (co-viewing exists so an adult can help the child connect screen to world, which is literally Game 1).

> *"We designed to the AAP's 5 C's, not around them."*

### 7.3 Research grounding

Two complementary frameworks, non-conflicting.

**NDBI** (Naturalistic Developmental Behavioral Interventions) — Early Start Denver Model, Pivotal Response Training. Primary relevance: autism. Follow the child's interests; teach inside natural play and routines, not artificial drills.

Meta-analytic effects: expressive language g = 0.32 · autism symptom reduction g = −0.38 · play skills g = 0.23 · **social engagement g = 0.65** · overall cognitive development g = 0.48. **Real but mostly modest — say so.** Overclaiming is the fastest way to lose a Q&A.

**Task analysis, errorless learning, prompting hierarchy and fading** — special education techniques from intellectual/developmental disability work, directly applicable to ADHD (short, clearly sequenced steps with fading support help task initiation and follow-through). Break a skill into the smallest teachable steps, give heavy support early so the child succeeds more than they fail, fade as data shows readiness.

**Three findings map to features:**

1. **The child's own interests are the mechanism, not a gimmick** → §6, the Context Profile
2. **Generalization is the hard problem.** A skill learned in one place doesn't transfer. A generic stock "circle" doesn't help a child recognise a circle on their own dinner plate → the camera exists to close this gap. Content *is* the child's real environment, so there is no transfer gap to begin with
3. **The caregiver is part of the intervention, not a bystander.** Parent-implemented intervention and visual supports are both high-evidence for this population → caregiver sets up, child uses

**Ammunition against competitors:** the field's own published critique of discrete trial training is that it produces limited generalisability, lack of spontaneity, and excessive prompt dependence. That is precisely what most "special needs learning apps" actually are.

### 7.4 The capture flow

1. Parent chooses a context: home / yard / a new place
2. Parent chooses camera, **or skips to generic age-appropriate activities**
3. Parent photographs the room
4. **Faces auto-blurred on device before anything is sent.** Not optional, not dependent on the parent remembering
5. Photo is downscaled and sent for object identification
6. **Photo is discarded after processing — never stored.** Only the resulting activity content is kept
7. Detected objects map to skills via the lookup table (§7.5)
8. Parent sees 3–5 candidate activities, each with a suggested starting support level
9. Parent picks one to run

**A second capture type exists:** the **Companion portrait** (§6.2), subject to the same face-rejection gate. Unlike room photos, **the Companion photo is stored on device** — it's needed every session. Be precise about this distinction when discussing privacy.

### 7.5 Object → activity mapping

> The hardest engineering problem in the app. **In 48 hours it must be a rules-based lookup, not model improvisation.**

`detected object → skill template → ordered steps`

Build a table covering ~15 common household objects (cup, ball, shoe, spoon, door, chair, book, toy animal, plate, towel, brush, box, blanket, bottle, sock) mapped to 3–4 skill templates each.

**Say "rules-based mapping" in the pitch.** Judges respect honest simplicity, and a lookup table always works on demo day. An LLM improvising steps live is a demo failure waiting to happen.

### 7.6 The support-level ladder

The mechanism that makes the app adaptive over time. Identical across all three games.

| Tier | Caregiver instruction | What it looks like |
|---|---|---|
| **1 · Full physical** | "Walk with them and guide their hand to it" | Hand-over-hand |
| **2 · Partial physical** | "Walk with them, touch their elbow to steer" | Light steering |
| **3 · Gesture** | "Point to it from where you are" | No touch |
| **4 · Verbal** | "Say 'it's near the table'" | Words only |
| **5 · Independent** | "Wait. Let them go." | Nothing |

**Session flow:**

1. Step-by-step instructions shown, including **how** to give support at the current level (errorless learning — generous support early so the child succeeds more than they fail; confidence first, fading later, never the reverse)
2. After the activity the parent logs **how much support was actually needed** — not "did they enjoy it"
3. **Fading logic:** the system tracks support level per skill across sessions. A consistent pattern of needing less triggers a suggestion to try a lower level next time. A genuine adaptive loop, not a one-shot recommendation
4. **Generalization testing:** once a skill is independent in one context (the kitchen), it's deliberately re-introduced in another (the bedroom). A drop back to needing more support is **never flagged as regression** — it's an expected, logged part of generalization, and support fades again from there, typically faster
5. History can be exported for a therapist **only on explicit parent action** — never presented as a score or conclusion. The professional interprets it, not the app

**Portability note:** because the device travels with the child, tiers 1–2 are actually workable — previously an adult had to choose between guiding the child's hands and standing near a screen.

### 7.7 Interaction spec — right, wrong and idle

> The support ladder operates **across sessions**. This is the **moment-to-moment** loop. It's what a judge will poke at, because it's where every competitor does something crude. ~40–60 lines of state-machine logic.

**Core principle — errorless learning.** The child never ends a trial in a failure state. Every trial ends in a completed, correct action; the app adjusts how much help it gives until that happens. The exact opposite of quiz-app logic.

#### Correct answer

| Step | Timing | Behaviour |
|---|---|---|
| Acknowledge | <200ms | Target gently scales up + {fav_sound} chime (if sound enabled) |
| Name it | ~0.5s | Audio names it possessively — *"**your** red cup"* — using the captured photo, not stock art |
| Co-play prompt | ~1.5s | **Every 3rd–4th success only.** Firing every time turns it into noise |
| Advance | ~2.5s | Auto-advance. No "Next" button — extra taps are a barrier at this age |

**No** points, stars, confetti, or score counters anywhere. The object *is* the reward.

> **This is a research position, not a kindness.** NDBI explicitly moves away from artificial extrinsic reinforcers toward the child's preferred interests and natural consequences, because extrinsic rewards don't generalize — the child learns to perform for the star, not the thing. **A star-chart app is actively misaligned with the evidence base it would claim to be built on.** Defend the no-score design on this ground.

#### Wrong answer — prompt hierarchy (least-to-most)

Escalate one tier per wrong attempt or timeout. Never skip tiers; never reset mid-trial.

| Tier | Trigger | Behaviour |
|---|---|---|
| **0 · Wait** | Trial starts | Nothing. Most "wrong" answers are rushed responses — give processing time |
| **1 · Repeat** | 1st wrong, or 8s idle | Wrong option fades to ~40% and becomes non-interactive. Audio repeats, slightly slower |
| **2 · Highlight** | 2nd wrong, or 20s idle | Correct target gets a soft pulsing outline; remaining distractors fade |
| **3 · Animate** | 3rd wrong, or 35s idle | Target does a small bounce. Only the target remains tappable — the child now cannot fail |
| **4 · Co-play handoff** | 45s idle, or tier 3 exhausted | *"Let's do this one together — can you show them the red one?"* Caregiver-facing; no failure framing reaches the child |

**Attempt cap:** after tier 3 the trial completes as correct regardless. Log as **prompted**, never *failed*.

**Never:** red X, buzzer, shake animation, "Try again!", or any sound identifiable as negative. A wrong tap produces **silence plus fade** and nothing else.

#### Idle and disengagement

**Passive idle** is handled by the timings above. **Active disengagement** watches *behavioural* signals only — never emotion, never facial analysis:

| Signal | Threshold | Response |
|---|---|---|
| Rapid random tapping | 4+ taps in <2s on non-targets | Pause trial, movement break |
| No input at all | 45s | Co-play handoff (tier 4) |
| Repeated tier-3 prompting | 3 consecutive trials | Step difficulty down, or switch modality |
| Total idle | 90s | End session gracefully, log as short |

#### Movement breaks

- **Content:** one instruction, 20–30s. *"{movement} like a {fav_animal}!"*
- **Delivery:** audio + simple icon animation. No scoring, no counting the child's actual movements
- **Return:** always to a task **one level easier** than the one that triggered it
- **Frequency:** higher for Q2 *"a minute or two"* profiles; lower and more predictable for Q3 *"sameness helps"*
- **Cap:** 3 per session. More means the activity is mismatched — step difficulty down instead

#### Session end

Three exit conditions, one ending: session cap reached · total idle >90s · caregiver ends it.

**Child-facing:** Companion waves goodbye in {fav_colour}, one line of audio naming a real object from this session — *"{companion} says go find your {object} with {caregiver}!"* Then the app becomes non-interactive. **No "play again" button.** The fade, made literal.

**Caregiver-facing** (one tap away): session recap, longest focus stretch, objects recognised, offline suggestion in text.

#### Config block

```
FIRST_PROMPT_DELAY      = 8s
TIER_2_DELAY            = 20s
TIER_3_DELAY            = 35s
COPLAY_HANDOFF_DELAY    = 45s
SESSION_END_IDLE        = 90s
RAPID_TAP_WINDOW        = 2s / 4 taps
MAX_ATTEMPTS_PER_TRIAL  = 3   (then errorless completion)
STEP_UP                 = 3 consecutive unprompted correct
STEP_DOWN               = 2 consecutive tier-3 completions
SESSION_CAP             = 12 min (session 1), −1 min/session, floor 6 min
MOVEMENT_BREAK_MAX      = 3 per session
TOUCH_TARGET_MIN        = 88 × 88 pt
```

One config object. If asked why these numbers: *"tuned for preschool processing speed, and adjustable per child."*

> **Demo instruction: deliberately tap wrong on stage. Twice.** More persuasive than any slide about design philosophy, and it proves the state machine runs.

### 7.8 Social story sub-flow — preparing for a new place

Showing a child photos of a new place beforehand is well-supported for reducing transition anxiety, particularly for autistic children.

1. Parent photographs the new place (school, clinic, a relative's home)
2. **Mandatory checkpoint:** confirm no other children are visible, and that permission was given by whoever manages the location
3. System generates short, age-appropriate sentences matched to what's visible — *"Tomorrow we go here. This is the door. This is where we put our shoes."*
4. Result is a simple picture book shown repeatedly in the days before the visit

> **This is the only place in the entire app where the child looks at a screen for any length of time.** Every other flow has the child interacting with the real room and real objects.
>
> **Say this in the pitch.** It is a stronger screen-time answer than the session cap, and stronger than anything a competitor can claim.

### 7.9 Caregiver dashboard

- **Plain-language recap** — *"12 minutes, 3 activities, 2 movement breaks. Longest focus stretch: 4 minutes."*
- **Focus-stretch trend** — longest sustained attention per session. The metric ADHD caregivers care about most, and a measurable unit of impact
- **"What worked today"** — which activity types held attention longest, so caregivers can replicate offline
- **Generalization tracker** — which skills have generalized to independence, across which contexts. Only possible because content comes from the child's real environment. **No competitor can show this**
- **Context engagement** — which profile items drive attention
- **Adherence-aware framing** — never rewards streaks or total time. Shortening sessions is shown as progress, not decline
- **One-page export** for a therapist or educator
- **Permanent banner:** *"This is an activity log, not a clinical assessment."*

### 7.10 Cross-cutting requirements

- **Faces blurred on device; the photo is then processed and discarded, never stored.** Companion photo is the one exception and stays on device
- **Offline-capable.** Once session content is generated, the session runs with no internet
- **Zero-text child UI** — icons and audio only
- **No-fail design** — no red X, no buzzer, no visible score; every attempt gets positive reinforcement naming the *effort*
- **Periodic co-play prompts** — a tool that supports real adult-child interaction, not a replacement for it

---

## 8. The three games

### 8.0 Shared foundations

**What the engine hands each game:** object crops from the room photo, each tagged `{name, colour, category, function, bbox}`. That's the entire content library. Games are thin layers arranging those crops differently.

**Two audiences, one device.** The screen shows the *caregiver* view; audio is for the *child*. The child comes to the screen only at the moment of confirmation.

**The support ladder (§7.6) is caregiver-facing** and identical across all games. **Errorless completion always** — support escalates until the child succeeds; a trial ends only in success with a recorded support level.

---

### 8.1 Game 1 — Find It In Your World

**Target skill:** receptive identification and generalization.

**Why this skill at this age:** receptive language develops before expressive, so a pre-verbal child can demonstrate knowledge here they can't demonstrate by speaking. And the generalization gap is the documented core problem — a skill learned on a flashcard doesn't reach the child's own cup. This game closes it by never leaving the child's real environment.

**The loop:**

1. **Prompt.** Audio: *"{companion} wants something {fav_colour}! Can you find it?"* Caregiver screen shows the target, the current support tier instruction, and a large **"They brought it"** button
2. **Child leaves the screen**, finds the object in the actual room, caregiver supports at the current tier
3. **Child returns** with the object; caregiver taps *They brought it*
4. **Confirmation.** 2–6 crops appear, large (carousel on phone). Audio: *"Show me — which one did you bring?"*
5. **The child taps.** This is the one screen interaction, and it's meaningful: matching the real object in their hand to its image **is** the generalization moment, made literal
6. **Correct** → crop scales up, audio names it possessively, Companion celebrates
7. **Wrong** → prompt hierarchy per §7.7
8. **Log** the support tier, advance

**Why not photograph each answer:** one capture per session, not per trial, keeps the loop fast and keeps it offline. Aiming a camera at a specific object is a fine-motor task the child may not have. And flat per-session API cost is a real Feasibility point.

**Optional camera verify** on generalization re-tests only (Level 4 / new-context trials). One tap, updates the generalization tracker. Never blocking, always skippable.

**Difficulty axes:**

| Axis | L1 → L4 |
|---|---|
| Prompt type | Named object (*"your red cup"*) → attribute (*"something red"*) → category (*"something you drink from"*) → function (*"something you use when you're thirsty"*) |
| Grid size | 2 crops → 6 crops |
| Distractors | Unrelated → sharing a feature with the target |
| Search scope | One visible area → whole room → **a different room** (the generalization re-test) |

**Two context-unlocked target types:**

- **Companion hunt** — *"Where's {companion}?"* The child hunts their actual toy. Highest motivation available; reserve for the session's final trial so it stays special
- **Preference category** — *"find something you eat"* → answer set includes {fav_food}, which the child is most likely to know

**Context threading:**

| Element | Generic | With context |
|---|---|---|
| Prompt | "Find something red" | *"{companion} wants something {fav_colour}!"* |
| Target selection | Random | Weighted toward {fav_colour}, the Companion, objects near {fav_place} |
| Helper framing | — | *"{companion} can't reach the {object}. Can you get it for {companion_they}?"* |
| Success | "Correct!" | *"Your {object}! {companion} is so happy!"* — reward framed in {fav_colour} |
| Movement break | "Jump five times" | *"{movement} like a {fav_animal}!"* |
| Session end | "Go find something red" | *"{companion} says go find your {object} with {caregiver}!"* |

**Profile tuning:**
- **Calm / sameness / minimal words:** literal prompts only, no idioms; identical phrasing every trial; fixed grid layout; no timer of any kind; reward crop in the same position every time
- **Lively / short attention:** shorter prompt; movement folded into retrieval (*"run and find something {fav_colour}!"*); faster celebration; movement break every 3 trials

---

### 8.2 Game 2 — Toy Story Sequencing

**Target skill:** temporal ordering and simple narrative.

**Why this skill:** sequencing underpins both language (events have order) and daily-routine independence. Visual supports have one of the strongest evidence bases for this population, and this game produces the same artefact as a visual schedule — a real clinical tool, not just a game outcome.

**The loop:**

1. **Setup.** The engine picks 2–4 crops forming a routine from the child's own objects, using a routine anchor from §6.2
2. **Model it.** Crops appear in order, one at a time, with audio. *"Sameness helps"* profiles play this twice, identically
3. **Act it out (the real-world half).** Caregiver screen: *"Do it with the real {companion}!"* The child performs the sequence with the actual object. **This is where the learning happens; the screen is only the score**
4. **Scramble.** Crops reshuffle. Audio: *"Now you put them in order"*
5. **Child taps** the crops in sequence — tap-to-place is default; drag works if attempted but is never required, because sustained-contact dragging is genuinely hard with fine-motor differences
6. **Wrong tap** → silence, crop springs gently back, nothing marked. Second wrong → only the correct next crop stays tappable
7. **Complete** → sequence plays back with audio: *"That's your bedtime!"*
8. **Save as a visual schedule** — printable strip the caregiver can put on the wall

**Example — profile: Bunbun the rabbit, Maya, Dada, routine anchor "bath time":**

> 🔊 *"First — Bunbun gets in the bath. Then — Bunbun washes with the yellow duck. Last — Dada dries Bunbun with the blue towel."*
>
> Crops: Maya's actual bath, her actual rubber duck, her actual towel.

A story about her toy, in her bathroom, with her things, and her dad — generated from a template and a photo, with **no model call at runtime**.

**Difficulty axes:**

| Axis | L1 → L4 |
|---|---|
| Steps | 2 → 3 → 4 |
| Familiarity | The child's own daily routine → a novel sequence |
| Cueing | Audio names each step during ordering → audio only at start → no audio |
| Reversibility | Visually obvious order (sun→moon) → arbitrary order that must be recalled |

**Profile tuning:**
- **Calm / sameness:** always the child's real routine, never invented; "first / then / last" framing throughout; identical playback every time; the saved strip doubles as their actual daily schedule
- **Lively / short attention:** 2 steps to start regardless of level; the act-it-out step is mandatory, not optional (movement between taps); playback is fast

**Phone layout:** vertical strip, up to 4 steps top to bottom.

---

### 8.3 Game 3 — Three alternating modes

**Target skill:** visual discrimination and abstraction — recognising an object from progressively less information.

**Why this skill:** matching-to-sample is a foundational early-intervention skill with a well-defined developmental ladder — identical matching → matching across angle and lighting → matching to an abstracted form. Climbing that ladder *is* generalization, in miniature.

**Why three modes:** all three consume the same crops and the same difficulty ladder, so the marginal cost is low. And a single repeated interaction shape gets stale fast at this age — staleness is an adherence problem.

#### Mode A — Shadow Match

Silhouette at top, real photos below, child picks the match.

| Level | Sample shown |
|---|---|
| 1 | Identical photo |
| 2 | Same object, different angle or lighting |
| 3 | Black silhouette |
| 4 | Silhouette, **answer not on screen** — child fetches the real object |

**Reward:** the silhouette dissolves into the real photo of *their* object.

Silhouettes are generated client-side from the crop (threshold + fill). No extra API cost, no latency. **Level 4 hands directly into Game 1's loop** — intentional, and it reinforces that the two are the same skill at different distances.

#### Mode B — Trace

Silhouette of one of their objects; the child traces it with a finger.

**No accuracy threshold.** Any sustained contact along the path fills it in. The line follows the finger and stays filled — no wrong stroke, no restart, no "try again." This preserves the no-fail design absolutely, and touch makes it viable where a trackpad didn't.

| Level | Outline |
|---|---|
| 1 | Large, simple, thick guide line |
| 2 | Guide line thins |
| 3 | Guide line becomes dotted |
| 4 | Guide line disappears after a 2-second preview |

**Reward:** the traced outline fills with the actual photo of their object.

#### Mode C — Puzzle

A photo of one of their objects splits into 2–6 pieces, scattered. Tap-to-place default (tap a piece, tap a slot); drag works if attempted, never required.

| Level | Pieces |
|---|---|
| 1 | 2 pieces, slots outlined |
| 2 | 4 pieces, slots outlined |
| 3 | 4 pieces, no outlines |
| 4 | 6 pieces, no outlines |

**Errorless:** wrong placement silently returns the piece. After two wrong attempts on the same piece, only its correct slot stays active.

**Reward:** completed image animates to full size, audio names it.

#### Rotation and context

- **One mode per session**, cycling A → B → C
- **Level carries across modes.** A child at Level 3 in Shadow Match starts Level 3 in Trace. The difficulty ladder belongs to the child, not the mode
- **Q3 governs rotation speed:** *"sameness helps a lot"* → stays on one mode for three sessions and is told in advance (*"next time we'll do puzzles"*). *"Likes variety"* → rotates every session
- **Parent can pin a mode** if their child clearly prefers one

| Mode | Context usage |
|---|---|
| Shadow Match | The **Companion's silhouette is the Level 1 sample every session** — the most recognisable shape in the child's world, and the gentlest entry rung |
| Trace | Outline fills with the actual photo; if it's the Companion, they wave when complete |
| Puzzle | **First puzzle of every session is the Companion's photo.** Assembling their own toy is a far stronger completion moment than a generic shape |

Across all modes: success chime is {fav_sound} unless the avoid list excludes it; UI accent is {fav_colour}; Level 4's *"go find this one!"* uses the Companion's voice.

**Build order within Game 3:** Shadow Match → Puzzle → Trace. Cheapest and most demoable first; cut from the back.

**Phone layout:** sequential reveal, 2 options at a time.

---

### 8.4 Worked simulation

*Maya, 4. Profile: calm, a few minutes, sameness helps, single words. Companion: Bunbun the rabbit. Favourite colour red. Caregiver: Dada. Session 3. Current support tier: 3 (gesture).*

**Game 1, trial 1 — Level 2, grid of 3**

> 🔊 *"Bunbun wants something RED! Can you find it?"*
> 💻 *Target: something red · Support 3 — point to it from where you are · [They brought it]*
>
> Dad points toward the kitchen bench. Maya walks over, picks up the red cup, brings it back. Dad taps **They brought it**.
>
> 🔊 *"Show me — which one did you bring?"* · Grid: red cup · blue ball · white shoe
> Maya taps the red cup.
> 🔊 *"Your red cup! Bunbun is so happy!"* — crop scales up in red
> 📊 `red / receptive-colour / support 3 / unprompted`

**Trial 2 — the wrong-answer path**

> 🔊 *"Bunbun wants something BLUE!"* Maya returns with the blue ball. Dad taps **They brought it**.
> 💻 Grid: blue ball · green plate · yellow book
>
> Maya taps the green plate. → **Silence.** Plate fades to 40%, becomes untappable. No sound, no colour change, no X.
> 🔊 *"Which one did you bring?"* — same words, slightly slower
> Maya taps the yellow book. → Fades. **Blue ball pulses softly.** Only it remains tappable.
> Maya taps the blue ball. → 🔊 *"Your blue ball!"* — full celebration, identical to a first-try success
> 📊 `blue / support 3 / prompted-tier-2`
>
> **Maya experienced this as: found it, showed it, got it right.**

**Trial 3 — co-play fires**

> 🔊 *"Bunbun wants something you can WEAR!"* Maya returns with her white shoe, taps it correctly.
> 💻 *Ask Maya to show you something else she can wear.*
> Dad: "What else can you wear?" Maya runs to get her hat. **The app isn't involved.**

**Final trial — Companion hunt**

> 🔊 *"Where's Bunbun?"* Maya runs to her bedroom, returns with Bunbun, taps his photo.
> 🔊 *"You found Bunbun!"*

**Session end at 12 minutes**

> Bunbun waves in red. 🔊 *"Bunbun says go find your red cup with Dada!"* Screen goes non-interactive. No replay button.

**Fading check:** 3 unprompted successes at tier 3 → next session opens at **tier 4 (verbal)**. Caregiver sees: *"Maya's been finding things with just a point. Next time, try only telling her — no pointing."*

**Game 2, same profile**

> 🔊 *"First — Bunbun brushes teeth. Then — Bunbun goes to bed."* (played twice, identically)
> 💻 *Do it with the real Bunbun — brush teeth, then bed.*
> They walk to the bathroom and act it out. Two minutes, no screen.
>
> 🔊 *"Now you put them in order."* — crops now show bed first
> Maya taps bed → silence, springs back, nothing marked
> 🔊 *"Which one is first?"* → Maya taps toothbrush → locks into slot 1
> Maya taps bed → locks into slot 2
> 🔊 *"First brush teeth. Then bed. That's your bedtime!"*
> 💻 *[Save as bedtime schedule]*

**Game 3, Mode A, Level 3 → 4**

> Silhouette of Bunbun at top; teddy, ball, shoe below. Maya taps ball → silence, fades, dead. Taps Bunbun → **the silhouette dissolves into the photo of her actual rabbit.**
>
> Level 4: silhouette of the red cup, **no options on screen.** 🔊 *"Go find this one!"* Maya leaves, returns with the red cup, Dad taps, Maya confirms → silhouette dissolves into her cup.
> 📊 `red-cup / abstraction-L4 / support 3 / unprompted` → **generalization tracker updated**

---

## 9. Branch 2 — Worry to question

### 9.1 The core problem

A parent notices something unsettling but has no path forward: they don't know whether it's within normal range, they don't know who to ask, and they're often carrying conflicting advice (*"don't worry, they'll grow out of it"*).

This branch does **not** answer "is something wrong." It turns a vague, emotional worry into a **specific, answerable question**, and connects the parent to the people whose job it is to answer it.

### 9.2 Why it deliberately does NOT screen or score

> The strongest paragraph in the document. Lead the Branch 2 portion of the pitch with it.

The best-validated screening tool available for autism (M-CHAT-R/F) is correct roughly 58% of the time when it flags a positive, and about a quarter of children who screen clear are diagnosed later anyway.

**If a clinically validated instrument has error rates that large, a tool built in a weekend has no business showing a parent anything resembling a screening result.**

So this branch doesn't compete with official developmental screening. It exists purely to help a parent reach the people who administer it — faster, and with a clearer question.

### 9.3 Flow

1. Parent reads milestone information as **narrative, not a yes/no checklist**
2. Asked: *is there anything here that's been on your mind?*
3. **If no →** the flow ends. No score, no result, nothing recorded as a finding
4. **If yes →** continue
5. **Guided prompts, not free text.** Three short fields:
   - *"What did you notice?"*
   - *"How old were they when you first noticed?"*
   - *"What does it look like when it happens?"*
6. Restructured into a clear, specific, answerable observation — stripped of diagnostic language, risk framing, and words like *"delayed"*
7. **Question card** can be printed or saved, alongside the nearest child-health service and its schedule
8. Parent decides: **bring the card in** → the official pathway takes over, **the app's role ends at the handoff**; or **not ready yet** → the card stays on device, reopenable any time
9. **Immediately after, the parent is offered a Branch 1 activity** — a high-motivation Companion trial. Leaving a parent newly aware of a concern with nothing to do is the worst outcome this branch could produce

**Why guided prompts, not free text:** typing a paragraph on a phone at 11pm while emotionally unsettled is the barrier most likely to make a parent abandon the flow. Guided prompts are shorter, and they produce **more structured input for the card generator**, which reduces hallucination risk in §9.4. **Voice input is the roadmap line:** *"next step is voice, because the parents who most need this are the least likely to type a paragraph."*

### 9.4 Output guardrail — hard constraint

> Step 6 is a language-model transformation of a parent's words about their child's development. Without constraints it can hallucinate a symptom the parent never reported — the exact harm §9.2 exists to prevent.

The card is **constrained to a fixed template**. It may contain:

- **Only observations the parent literally stated**, rephrased for clarity — never inferred, extended, or "completed"
- The child's age in months
- **Three fixed questions**, identical every time:
  1. *Is this within a typical range for this age?*
  2. *What should I watch for over the next few months?*
  3. *Would a developmental check be worth scheduling?*

**Banned from output, enforced by a post-generation check, not by prompt alone:** any condition name; the words *delayed, disorder, risk, concerning, abnormal, symptom, likely, probably, suggests*; any severity, probability or percentage; any recommendation beyond "ask a health worker."

**If the check fails, the card is not shown.** The parent is offered the raw text of their own words instead. Degrading to the parent's own sentence is always safe; a hallucinated symptom never is.

**Show the parent the card before saving, with an edit option.** They are the authority on what they observed.

### 9.5 Example transformation

**What a parent might enter:**

> *What did you notice?* — "hasn't said mama, just babbles to herself"
> *When did you first notice?* — "around 18 months"
> *What does it look like?* — "she makes lots of sounds but not at me. my neighbour says don't worry"

**The resulting card:**

> **To ask your health worker:** My child is 20 months old. They have not yet said a word directed at another person, though they frequently vocalise on their own. I first noticed this at around 18 months.
>
> 1. Is this within a typical range for this age?
> 2. What should I watch for over the next few months?
> 3. Would a developmental check be worth scheduling?

Notice what's absent: no suspected condition, no risk level, no word like *delayed*. Only the parent's own observation, cleaned up into something a health worker can directly respond to.

---

## 10. How the branches connect

The most failure-prone part of the design, so the rules are explicit.

**Branch 1 → Branch 2.** If a parent repeatedly marks "didn't want to / couldn't do it" in the same skill domain, the system **does not** raise a warning, compute anything, or draw a conclusion. The only thing that appears is the same neutral prompt available everywhere: *"Want to save a note about this to ask about later?"*

Without this restraint, activity history would slowly become a disguised screening tool — directly contradicting the app's own principles. **This matters more now that there's no condition field:** activity history is the only condition-adjacent data in the app, and it must never become a screen.

**Branch 2 → Branch 1.** Once a question card is created, the parent is immediately offered a relevant activity. Making a parent aware something might be worth asking about and then leaving them with nothing to do is the most efficient way to generate anxiety with no benefit. **The branches always hand back to each other; a parent is never stranded.**

**Context use in Branch 2 is minimal and careful.** The Companion does not appear — this branch is for the parent, and a cheerful toy voice would be tonally wrong next to a worry. Only two uses: the child's name and age in the card, and a Companion trial offered on the handoff back to Branch 1.

---

## 11. Failure and degradation

Something will go wrong on stage. These paths must exist and must be tested.

| Failure | Behaviour |
|---|---|
| **Object recognition returns nothing usable** | Fall back to generic age-appropriate activities for the chosen context. Never show an error — the flow continues, quietly degraded |
| **Recognition is slow (>4s)** | Calm progress state showing the parent's own photo. Never a spinner over a blank screen |
| **No internet at capture** | Queue the capture; offer previously generated activities meanwhile. The session itself never requires connectivity |
| **Face-blur fails or is uncertain** | **Hard stop.** Discard the photo, tell the parent it couldn't be processed, offer to retake. Never proceed on an unblurred image |
| **Face detected in a Companion photo** | Reject with *"Let's use a toy or object instead."* |
| **Branch 2 guardrail check fails** | Card not shown. Offer the parent their own raw text (§9.4) |
| **Camera permission denied** | Both branches fully usable. Branch 1 falls back to generic activities |
| **Device rotated mid-session** | Phone is locked to portrait. Tablet re-lays out without losing session state |
| **Demo-day API outage** | Pre-seeded object set + hardcoded skill mappings. **Test this path before the demo, not during it** |

---

## 12. Architecture

The engine is shared; games are interchangeable modules on top. The single most important structural decision for the build plan — and the mechanism that makes §16's fallback free.

### 12.1 Shared — build once

- **My World pipeline:** capture → face blur → downscale → object recognition → discard photo
- **Response profile** (four questions) and the optional declaration pre-fill
- **Child Context Profile** and the **slot system**
- **Avoid-list filter** — runs last on every generated string
- **Support-level ladder** and fading logic
- **Interaction state machine** — errorless completion, prompt hierarchy, idle handling, movement breaks
- **Generalization re-testing** (same skill, new context)
- **No-fail / natural-reward** feedback model
- **Session cap and fade**
- **Caregiver dashboard** and metrics
- **Responsive layout patterns** (§4.3)

### 12.2 Per-game — a thin layer

Each game defines only: **what skill it targets**, **what interaction shape it uses**, **how it renders a step**. Support level, fading, generalization, logging, reward and layout all come from the engine automatically.

### 12.3 Why this matters

Adding a game later requires only a skill and an interaction shape — not rebuilding fading logic, generalization testing, or the dashboard. Adding a new need later (speech delay, considered and deferred) requires only new tuning dimensions — not a new engine. There are no "conditions" to add, because needs are expressed as response-profile dimensions.

**This is also the scope-safety mechanism.** Cutting Game 2 or 3 costs nothing structurally, and you can honestly say the architecture supports more.

---

## 13. What this app never does

As important as the feature list. This is what prevents it becoming the kind of tool it exists to be an alternative to.

- **Never scores or grades** a child's development
- **Never analyses a child's face, expression or behaviour** from photo or video — and never asks for a photo of the child at all
- **Never accepts a photo containing a person**, for any capture type
- **Never predicts or suggests a diagnosis**, at any confidence level
- **Never requires a diagnosis** to unlock anything
- **Never judges the quality of a home or of parenting.** Output is always *"here's something you can do with what you already have"* — never a score, a judgment, or a suggestion to buy something
- **Never attempts to detect hazards** in the home (e.g. an open power outlet). Sounds useful; sits in a domain of judgment and liability the app has no business claiming
- **Never claims therapeutic outcomes.** *"Designed on principles from NDBI and special-education research"* — never *"clinically proven"*
- **Never sends data anywhere** without an explicit per-instance parent action

> Judges reward teams that name things they *could* have built and chose not to. Put two of these in the video.

---

## 14. Data handling

| Data | Handling |
|---|---|
| Room / environment photos | Faces auto-blurred on device → downscaled → processed for activity generation → **discarded, never stored** |
| **Companion photo** | **Stored on device** — the one image that persists, because it's needed every session |
| Child's age, nickname, profiles | Stays on device |
| Activity history / support-level logs | Stays on device |
| Question cards (Branch 2) | Stay on device; leave only if the parent themselves brings or shows them |
| Therapist export | Generated on demand, only on explicit parent action |
| Third parties | **Never automatic, under any circumstance** |

**No account, no login, no cloud sync.** Say this plainly — it removes an entire category of judge concern about a camera-plus-children product before it's raised.

> **Be precise about the privacy claim.** Do not say "photos never leave the device" — room photos are sent for recognition. Say: *"Faces are blurred in the browser before anything is sent. The photo is processed and discarded, never stored. The only image that persists is the toy, and it stays on the device."* That is true, and still strong.

---

## 15. Regional framing

Earlier drafts mixed *"Duniaku,"* *"local child health post,"* and M-CHAT references — reading as designed for Indonesian families while pitched in Melbourne. Ambiguity looks like confusion; a stated choice looks like insight.

Pick one and say it in the video:

- **Option A — Indonesian context, explicit.** Strongest Impact framing: low-resource setting, long diagnosis delays, a real referral pathway to hand off to, and a genuine "use what you already have" constraint. Requires real verifiable service information or clearly-marked placeholder data
- **Option B — Australian context.** Easier to verify, easier for local judges to sanity-check, weaker on resource scarcity
- **Option C — locale-configurable**, demoed with one locale. Honest and consistent with the modular architecture — credible only if referral information is genuinely swappable rather than hardcoded

**Whichever is chosen: never present placeholder service information as real.** Label it clearly in the demo.

---

## 16. Build scope — Option A, with Option B as fallback

Everything specified above is more than 48 hours holds. Two ways to handle that. **Both score 5s on Impact, Creativity and Feasibility** — the difference is entirely in how they protect Technical Execution.

| | **Option A — full scope, degradable** | **Option B — focused depth** |
|---|---|---|
| Ambition | Everything, ordered so every cut is clean | One game, built properly |
| Risk profile | High ceiling, real floor risk | Lower ceiling, near-zero floor risk |
| Fails if | Integration eats Sunday and nothing finishes cleanly | Nothing — worst case is a smaller working product |
| Demo | Whatever landed, presented as intentional | One game, deep, plus the architecture argument |

### 16.1 Option A — the tiers

Build in strict priority order. Every boundary is designed so stopping there still produces a coherent product. **Nothing half-built is ever visible.**

**Tier 0 — the floor (must exist by Saturday night, no exceptions)**
- Shared onboarding: age + nickname, two doors
- Response profile (4 questions)
- Companion capture: photo, name, pronoun
- Slot system
- Room capture → face blur → recognition → `object → skill → steps` lookup table
- **Game 1 end-to-end**, one difficulty level

*If only this exists, you still have a working, novel, demoable product.*

**Tier 1 — the credible product (Sunday midday)**
- Interaction state machine: errorless completion, 4-tier prompt hierarchy, idle handling
- Support ladder with caregiver logging
- Fading logic
- Game 1 difficulty levels 1–4
- Session cap + off-screen handoff
- Branch 2: guided prompts, guardrail, hardcoded example

*This is the version that competes for the track. Everything past here is upside.*

**Tier 2 — the differentiators (Sunday evening)**
- Favourite colour + movement wired through the slot system
- Companion-hunt trial and helper framing in Game 1
- Minimal dashboard: session recap, focus-stretch, generalization list
- Avoid list

**Tier 3 — cut first, without discussion (only if Tier 2 is done and tested)**
- Game 3 Mode A (Shadow Match) — cheapest second game, reuses everything
- Routine anchors + Game 2

**Tier 4 — do not start**
- Game 3 Modes B and C, generalization re-testing, people names, engagement-by-context, social story sub-flow

**The hard rule:** at **Sunday 8pm**, whatever tier is complete is what ships. Nothing new starts after that. Remaining time is integration testing, the video, and rehearsal.

### 16.2 Option B — focused depth

Option A's Tier 0 + Tier 1 + Tier 2, with the surplus hours spent on **polish and testing instead of breadth**: audio timing tuned, touch targets verified on real hardware, every §11 failure path exercised, two full demo rehearsals, the video shot Monday morning with time to reshoot, plus a one-page written spec for Games 2 and 3 shown on screen for four seconds as evidence of the modular claim.

### 16.3 Rubric projection

| Criterion | Option A (best) | Option A (bad) | Option B |
|---|---|---|---|
| Impact & Track Relevance | 5 | 5 | 5 |
| Creativity & Innovation | 5 | 5 | 5 |
| **Technical Execution** | **5** | **2** | **4–5** |
| Feasibility & Viability | 5 | 4 | 5 |
| Presentation & Design | 5 | 3 | 5 |
| **Total / 25** | **25** | **19** | **24–25** |

**Note what this shows:** the second and third games are worth roughly *nothing*. Judges see one game working and one more working and score it as one idea, executed. Breadth doesn't compound; brokenness does.

### 16.4 Team decision

**We are building Option A. Option B is the fallback, and we can drop to it at any moment we choose.**

This works because the two options are **identical up to Tier 2** — Option B is not a different plan, it's Option A with the top tiers left unbuilt. Reverting costs nothing and requires no rework. There is no point at which switching means throwing work away.

**Three conditions make the fallback real rather than theoretical:**

1. **Checkpoint at Sunday 12pm.** Tier 1 complete? If no, freeze scope and consolidate. Not Sunday 8pm — deciding that late leaves no room to test, rehearse or shoot the video, which means reverting without gaining Option B's actual benefit
2. **Nothing half-built is ever visible.** Anything above Tier 1 goes behind a feature flag or on a branch that only merges when complete. A half-working second game costs more than no second game
3. **The video is owned from the start.** Whoever finishes Branch 2 by Sunday midday moves to video and rehearsal. This is the task most likely to be quietly dropped while the build is going well

**The gate is Tier 0 by Saturday night.** If that slips, we are already in Option B whether we've called it or not.

**The trap:** treating "we can always revert" as permission to over-reach on Saturday. The fallback protects against *running out of time*, not against *starting the wrong things first*. Build in tier order, always.

**Say the checkpoint out loud now**, while nobody is tired or invested in a half-finished feature:

> *Sunday 12pm — is Tier 1 complete? If no, we freeze.*

---

## 17. Build order

### Saturday 22 Aug — Hubday, 10am–4pm, and evening
- Shared onboarding (age + nickname, two doors)
- Response profile (4 questions) + optional declaration pre-fill
- **Companion capture** (photo, name, pronoun) + slot system
- **Mobile face-blur spike** — downscale, detect, map back, blur. Fallback gate ready if it isn't working by tonight
- Room capture → recognition → `object → skill → steps` lookup (~15 objects)
- **Game 1 end-to-end, one level** ← Tier 0 gate

### Sunday 23 Aug
- **Interaction state machine (§7.7)** — build before any second game
- Support ladder + caregiver logging + fading
- Game 1 levels 1–4
- Session cap, fade, off-screen handoff
- Branch 2: guided prompts + guardrail + hardcoded example — **finish by midday**
- **12pm checkpoint — Tier 1 complete? If no, freeze**
- Tier 2: colour/movement slots, Companion hunt, minimal dashboard, avoid list
- **8pm — scope freeze, no exceptions**

### Sunday night / Monday 24 Aug
- Integration testing on a real phone and a real tablet
- Every §11 failure path exercised, especially the API-outage fallback
- **Record video Monday morning**, not Monday night
- **Submit Monday afternoon.** Devpost at 11:59pm on a deadline is where projects die

> **Non-negotiable:** if something isn't working by Sunday evening, cut it rather than fix it.

---

## 18. Demo discipline

- **One response profile end-to-end** — calm / sameness / minimal words as the demo configuration
- **Branch 1, Game 1 is the live demo.** A room photo becoming activities in seconds is fast, visual, legible
- **Branch 2 is a walkthrough with a hardcoded example**, framed as the impact and reach argument
- **Pre-capture a My World library** so lighting isn't a live risk — **but take at least one live photo** to prove the pipeline is real
- **The profile-swap moment:** change the Companion, show the whole app change. Four seconds, proves the architecture
- **Deliberately tap wrong twice** to show the prompt hierarchy
- **Film on a tablet.** Mention phone parity; have the phone build open on a second device if the demo is going well
- **Use only fictional or team-member data.** Never a real child's photo or profile, in the build or the video
- **Show a caregiver and child together**, never a child alone with a device
- **Rehearse twice before recording**

---

## 19. Rubric mapping

### Impact & Track Relevance
- [ ] Video opens with the **barrier**, not the product
- [ ] Group named by capability, with a reason they're excluded from existing tools
- [ ] **The adherence finding cited** — proves we researched the field, not just the problem
- [ ] Explicit tie to **SDG 4** and the track's *cognitive and learning differences* + *language and literacy* categories
- [ ] Branch 2's reach argument — serves families who don't yet have a diagnosis at all
- [ ] Context Profile framed as the adherence lever, not decoration

### Creativity & Innovation
- [ ] **The Companion mechanic** — the child's own toy as the app's character
- [ ] **Capability-based profiling** over diagnosis-based
- [ ] **The fade** — an app designed to reduce its own use
- [ ] **The errorless prompt hierarchy** — visibly unlike quiz-app logic
- [ ] **The avoid list** — capturing what to stay away from, not just what they like
- [ ] **Branch 2's refusal to screen**, justified with M-CHAT error rates
- [ ] Name what exists (generic special-needs apps, flashcard drilling) and how we differ

### Technical Execution
- [ ] Core flow live: capture → blur → recognise → activity → interaction loop → dashboard
- [ ] At least one **live** photo capture on stage
- [ ] Interaction state machine demonstrated by deliberate wrong taps
- [ ] Profile swap visibly changes the app
- [ ] Every §11 fallback tested
- [ ] Tested on real hardware, both form factors
- [ ] Frequent, visible commits — organisers may inspect commit history

### Feasibility & Viability
- [ ] Privacy claim stated **precisely** (§14) — first 30 seconds
- [ ] Positioned as a **complement** to therapist-delivered intervention, never a replacement
- [ ] Cost model named (recognition calls per child per month, flat per session)
- [ ] AAP 5 C's cited as something designed **to**, not around
- [ ] Therapist export shows awareness of the real support ecosystem
- [ ] Branch 2 hands off to the **existing official pathway** rather than inventing one
- [ ] Works without a diagnosis — the population is larger and reachable sooner

### Presentation & Design
- [ ] Video **under 3 minutes**, working project shown, commentary throughout
- [ ] Zero-text child UI, 88pt touch targets, calm defaults
- [ ] Caregiver and child shown together
- [ ] Both branches legible in under 30 seconds each
- [ ] Phone parity mentioned, tablet filmed

---

## 20. Submission checklist

- [ ] Project description: problem, solution, construction method
- [ ] Track: **Accessible Education**
- [ ] Video, **max 3 minutes**, demonstrating it working
- [ ] Public **GitHub repository** link
- [ ] AI-assisted development disclosed, plus pre-existing libraries, assets, datasets
- [ ] First-year team flag if applicable (must match registration)
- [ ] All code written between the opening ceremony and the deadline
- [ ] Project name chosen

---

## 21. Open decisions

1. **Project name.** *"Duniaku"* is tied to §15 — resolve regional framing first
2. **Regional framing** — §15, Option A / B / C
3. **Branch 2 referral data** — real and verifiable, or clearly-marked placeholder
4. **Whether to speak to an early-childhood educator or OT.** Fifteen minutes materially strengthens Impact and Feasibility. Best question to ask: *"When a child gets something wrong, what do you actually do?"* — their answer will sharpen §7.7 more than any paper

---

## Appendix — Evidence and Q&A

### Evidence notes

- **NDBI meta-analysis:** expressive language g = 0.32 · autism symptom reduction g = −0.38 · play skills g = 0.23 · social engagement g = 0.65 · overall cognitive development g = 0.48. Real but mostly modest — say so
- **TOBY Playpad RCT (Telethon Kids / Monash, 2017):** null on the primary outcome; significant 6-month gains on Mullen Fine Motor, Mullen Visual Reception and total words understood. Sustained use over six months was a challenge for most families; 70% of carers still called it a helpful therapy planning tool. Positioned by its authors as a **low-cost complement** to therapist-delivered intervention
- **Field's critique of discrete trial training:** limited generalisability, lack of spontaneity, excessive prompt dependence. Our fading logic is explicitly designed to reduce prompts rather than depend on them
- **M-CHAT-R/F:** ~58% positive predictive value; roughly a quarter of children who screen clear are diagnosed later. The justification for Branch 2's restraint
- **Diagnosis timing:** autism median ~47 months; ADHD median 4 (severe) / 6 (moderate) / 7 (mild); dyslexia typically end of Year 2–3. Supports both the 3–5 band and capability-based framing
- **AAP 2026 screen guidance:** no screens before 18 months; ~1 hour/day high-quality content ages 2–5; **5 C's** — Child, Content, Calm, Crowding Out, Communication. Co-viewing is recommended specifically so an adult can help the child connect what's on screen to the real world

### Q&A quick reference

| Question | Answer |
|---|---|
| "Is this for autism or ADHD?" | Neither, and that's the point. It's for pre-verbal, pre-literate preschoolers. Diagnosis is irrelevant to whether it works — which matters, because diagnosis is usually delayed |
| "Why is there no diagnosis field?" | You can tell us if you want; it saves four taps. It doesn't unlock anything, because nothing should be locked behind a diagnosis a family may be two years away from getting |
| "What happens when the child gets it wrong?" | Nothing negative, ever. Errorless learning with a four-tier least-to-most prompt hierarchy; the trial always ends in success, logged internally as *prompted* |
| "Doesn't this just add screen time?" | The child barely looks at the screen — only in the social story flow. Everything else is real objects. Plus a session cap that shrinks over time |
| "You're photographing children's homes." | Faces blurred on device before anything is sent, photo discarded after processing, never stored. The only image that persists is the toy. No account, no cloud |
| "Isn't Branch 2 just a screening tool?" | No, deliberately. M-CHAT-R/F is right ~58% of the time on positives. We don't compete with validated screening — we help parents reach the people who administer it |
| "Can an app replace therapy?" | No, and the research says no. A low-cost complement to therapist-delivered intervention |
| "What did you build vs. use an API for?" | Recognition API for tagging. The skill-mapping table, support ladder, fading logic, prompt hierarchy, slot system, avoid-list filter and disengagement heuristic are ours |
| "Why only one game?" | We built a shared engine and took one game to depth. Adding a game is defining a skill and an interaction shape — here's the spec for the next two. One thing that works beats three that half-work |
| "Where's your evidence?" | NDBI meta-analyses for the pedagogy; TOBY for the adherence problem; errorless learning and prompting hierarchies from special education; M-CHAT error rates for Branch 2's restraint |
