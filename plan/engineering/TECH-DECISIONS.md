# Tech Decisions

Which technology answers each capability in `app-guide-v3-FINAL.md`. Section
refs (§) point at that document.

> **Read `ARCHITECTURE-RULES.md` first.** Every decision below is *which adapter
> we wire in first*, behind a port we own. Swapping any of it should cost under
> an hour.

## The shape of it

**Very little of this app is AI.** The guide is emphatic about that, and it's a
Feasibility strength, not a limitation.

| | How |
|---|---|
| Object recognition | **Vision model.** One call per session |
| Branch 2 question card | **Text model**, behind a hard post-generation guardrail |
| Activity steps | **Lookup table.** ~15 objects × 3–4 templates (§7.5) |
| Every line the app says | **Slot templates, filled deterministically** (§6.4) |
| Face blur | **On device**, in the browser |
| Everything the app remembers | **On device.** No account, no login, no sync |

Two model calls in the entire product. Everything else is rules — which is what
makes it work offline, work on demo day, and cost almost nothing per child.

## The privacy line — say it exactly this way

> **"Faces are blurred in the browser before anything is sent. The photo is
> processed and discarded, never stored. The only image that persists is the
> toy, and it stays on the device."**

**Never say "photos never leave the device."** Room photos are sent for
recognition. §14 is explicit about the wording, and overclaiming here is the
most damaging factual error the pitch could contain.

---

## Platform

**Decision: mobile web (PWA), tablet and phone, installable.** React +
TypeScript + Vite, static build.

**Why:** §0 locks tablet and phone, touch, full parity. A PWA meets that —
including a native camera via the browser — and it deploys instantly for judges
with nothing to install. A native build (React Native, Flutter) buys marginally
better camera control and costs a toolchain, a build pipeline, and distribution
friction the weekend does not have.

**Flagging the tradeoff honestly:** if the team wants a genuinely native app,
that is a different decision and it should be made now, not on Sunday. The
guide's requirements are satisfied either way; the PWA is the faster road.

**Reliability:** test on **one real tablet and one real phone** from Wave 0.
§4.4 says devtools emulation is not sufficient for touch-target sizing. Phone
locks to portrait — rotation mid-session is a disruption, especially for a child
who needs predictability.

---

## Camera

**Decision: `getUserMedia` in-app viewfinder**, with
`<input type="file" accept="image/*" capture="environment">` as fallback.

**Why:** §4.2 requires a native camera, not a file picker — the parent points
the device at the room and shoots. On mobile the `capture` attribute opens the
device camera directly, so the fallback is still "native camera", not a file
browser. Requires HTTPS, which the host provides.

**Denied permission is not a failure state** (§4.4): both branches stay fully
usable and Branch 1 falls back to generic activities. Camera is an enhancement,
not a gate.

---

## Face detection & blur — the one thing that stays local

**Decision: BlazeFace via TensorFlow.js**, in the browser, plus canvas pixel
manipulation for the blur.

**§4.4's exact approach:** downscale to ≤1024px → detect on the downscaled image
→ map boxes back → blur at full resolution → *then* send. **Budget half a day.**

**Blur destructively.** Mosaic the region (downsample and scale back up) then
apply a canvas blur pass, on the actual pixel buffer — not a CSS overlay, which
redacts nothing. The redacted buffer must be the only image that exists
downstream.

**Fail closed.** Detection throws → discard the photo, offer a retake, send
nothing (§11).

**The fallback, ready by the end of Wave 1 if the spike hasn't landed:** a hard
*"no people in frame"* confirmation gate. **Never ship an unblurred pipeline.**

**Reliability:** ~400KB model, cached after first load, then fully offline.
Imperfect on extreme angles and heavy backlight — which is exactly why the
fail-closed rule exists.

---

## Object recognition

**Decision: Claude vision, `claude-sonnet-5`**, via the serverless proxy. One
call per session. Returns objects tagged `{name, colour, category, function,
bbox}`; the app cuts crops from the bboxes.

**Why Sonnet:** it's the one call that reads a photo, and every game's content
library comes from it. Open-vocabulary, so a child's actual toy is describable
rather than forced into a fixed class list.

**Transmitted, not stored.** The redacted image goes to the API and is held for
the request. Nothing is written to disk, cached, or retained. That's the §14
claim, and it's true as stated.

**⚠ The top technical risk after face blur: bbox precision.** Vision models
describe well and localise approximately. **Crops are central** — the child taps
a crop to answer. A bad bbox is a bad crop is a broken Game 1.

Three mitigations, in order of preference:
1. **Pad the boxes generously.** A recognisable crop doesn't need to be
   pixel-tight.
2. **Let the parent tap an object in the photo** to reposition a crop, if one
   looks wrong. One tap, and it also makes a nice demo beat.
3. Fall back to the whole photo for that object.

**Test this in Wave 1 with real room photos.** If crops are unusable, you need
to know before F.008, not during it.

**Cost:** one image call per session. Flat, predictable, and a genuine
Feasibility talking point (§8.1).

---

## Activity steps & all generated text

**Decision: no model. A lookup table (§7.5) plus slot templates (§6.4).**

§7.5 is direct: *in 48 hours it must be a rules-based lookup, not model
improvisation.* Templates always work, are instant and free, run offline, and
**cannot hallucinate a personalisation.**

**Say "rules-based mapping" in the pitch.** Judges respect honest simplicity,
and an LLM improvising steps live is a demo failure waiting to happen.

---

## Branch 2 card generation

**Decision: `claude-haiku-4-5`, behind the §9.4 post-generation guardrail.**

Short, structured input (three guided prompts, not free text) → a fixed-template
card. Haiku is sufficient for a constrained rewrite of this size; the guardrail
is what carries the safety, not the model tier.

**The guardrail is a code check, not prompt wording.** Banned: any condition
name, and *delayed, disorder, risk, concerning, abnormal, symptom, likely,
probably, suggests*, plus any severity or probability. **Fails → the card is not
shown**, and the parent is offered the raw text of their own words.

**Test with the §9.5 example** before fixing the model. If Haiku adds an
observation the parent didn't make, escalate this one call site to
`claude-sonnet-5`. It's a constant in one adapter.

**For the demo, §0 says Branch 2 is a hardcoded walkthrough** — so the live
model call is not on the demo path. Build it real anyway; it's a five-minute
difference and it makes the Q&A answer honest.

---

## Audio

**Decision: Web Speech API `speechSynthesis`.**

Free, no quota, no key, offline from OS voices on most platforms. Load-bearing,
not decorative — §7.10 requires a zero-text child UI, so audio *is* the
interface.

**Three gotchas:** voices load async (wait for `voiceschanged`); **iOS requires
a user gesture before any speech plays** — use the session-start tap to unlock
it; voice quality varies, so the app must be usable with a poor voice.

**The Companion's voice is a TTS voice**, which is a small aesthetic cost on the
product's best feature. Cloud TTS is rejected — per-call cost, a network
dependency in the child-facing path, and it breaks offline sessions. **Polish
option if time allows:** record the fixed lines with a team member's voice and
keep TTS for the dynamic slots.

---

## Storage

**Decision: IndexedDB**, plus `navigator.storage.persist()`.

§14: no account, no login, no cloud sync. IndexedDB is the only on-device option
that handles session logs, per-skill support history, saved cards **and the
Companion photo** — the one image that persists.

**Watch eviction.** Safari evicts IndexedDB after ~7 days without interaction.
Request persistent storage, ship the PWA manifest and prompt to install, and
degrade to a clean empty state rather than crashing if the store is gone.

---

## Silhouettes (Tier 3)

**Decision: client-side threshold + fill** from the crop. No API cost, no
latency (§8.3). Only relevant if F.021 gets built.

---

## Hosting & secrets

**Decision: deferred, and built to be swapped.** Use a free tier during the
build; the team is weighing a paid host and possibly a domain.

**A static-only host cannot work on its own.** The API key can never ship in the
browser bundle — anything in it is view-source public — so one serverless
function must hold it. GitHub Pages can't run one. Everything else stays open.

Three rules keep the choice reversible, and cost nothing:
1. Build output is a **plain static bundle** — no host-specific runtime.
2. All server-side work lives behind **one function with one job**, reached via
   a configurable `VITE_API_BASE_URL`.
3. **Nothing in `src/` imports a hosting SDK.**

**Set a spend cap on the API account** when the key is created. Rate-limit the
function by IP — it's public and unauthenticated.

---

## Demo-day resilience (§11)

Every one of these must exist **and be tested before the demo, not during it**:

| Failure | Behaviour |
|---|---|
| Recognition returns nothing usable | Generic activities for the context. **No error shown** |
| Recognition slow (>4s) | Calm progress state showing the parent's own photo |
| No internet at capture | Queue it; offer previously generated activities |
| **Face blur fails** | **Hard stop.** Discard, explain, offer retake |
| Face in a Companion photo | Reject: *"Let's use a toy or object instead."* |
| Guardrail check fails | Card withheld; offer the parent their own raw text |
| Camera denied | Both branches usable; Branch 1 → generic activities |
| **API outage on demo day** | **Pre-seeded object set + hardcoded skill mappings** |

That last row is the one that saves the demo. Build it early and rehearse it.
