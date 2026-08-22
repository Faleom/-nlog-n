# Architecture Rules

Standing requirement. Every `F.00X` file obeys it.

---

## The rule

> **Every external capability sits behind a port we define. Nothing outside that
> capability's adapter folder imports a vendor SDK.**

If the vision model disappoints, write a new adapter and change one registry
line. F.007, F.008, F.012 and F.017 never hear about it.

This is the same principle `app-guide-v3-FINAL.md` already applies twice,
pointed outward:

| Where | The rule |
|---|---|
| §5.2 | Tuning keys off **response dimensions**, not a condition label |
| §12.2 | A game is a **thin layer** — skill, interaction shape, step rendering |
| **Here** | A provider is an **adapter** — swapping it changes no feature file |

Three instances of one idea: *the thing most likely to change must be the
cheapest to change.*

---

## The ports

| Port | Used by | Promises |
|---|---|---|
| `CapturePort` | F.006 | `capturePhoto() → Image` |
| `FaceDetectPort` | F.006, F.004 | `findFaces(image) → Region[]` — **local, never network** |
| `RedactionPort` | F.006 | `redactRegions(image, regions) → RedactedImage` |
| `VisionPort` | F.006 | `recognizeObjects(image) → TaggedCrop[]` |
| `TextGenPort` | F.015 | `generateCard(answers) → string` |
| `SpeechOutPort` | all audio | `say(text, settings) → Promise<void>` |
| `StoragePort` | F.001 | typed reads/writes |

**`FaceDetectPort` and `RedactionPort` must never be swapped for network
adapters.** Everything else here is a preference; that one is a §13 guarantee.
Blur happens locally, before anything is sent, which is what makes *"never
analyses a child's face"* true in the strongest available sense.

### Ports speak our language

`TaggedCrop` is **our** type — `{name, colour, category, function, bbox, image}`
— matching §8.0. Not the vision provider's response shape. A different provider
normalises to it at the boundary.

**`bbox` may be approximate.** The vision model localises loosely (see
`TECH-DECISIONS.md`), so consumers must tolerate padding and a
parent-repositioning path. Making that explicit at the port is what stops it
becoming a surprise inside Game 1.

## Every port ships two adapters

| Port | Real | Second |
|---|---|---|
| `CapturePort` | `DeviceCamera` | `FixtureCapture` — a bundled photo |
| `FaceDetectPort` | `BlazeFaceLocal` | `ConfirmGateDetect` — **the §4.4 fallback** |
| `RedactionPort` | `CanvasMosaic` | — |
| `VisionPort` | `ClaudeVision` | `FixtureVision` — canned crops |
| `TextGenPort` | `HaikuCard` | `RawTextCard` — the §9.4 guardrail fallback |
| `SpeechOutPort` | `WebSpeechOut` | `SilentSpeechOut` |
| `StoragePort` | `IndexedDbStorage` | `InMemoryStorage` |

Two of these second adapters aren't fallbacks in the abstract — **they're
required behaviour**. `ConfirmGateDetect` is §4.4's plan if the blur spike
doesn't land. `RawTextCard` is §9.4's mandated behaviour when the guardrail
fails.

The rest pay for themselves anyway: `FixtureVision` and `FixtureCapture` let
P1, P3 and P4 build against Game 1's inputs **before P2's pipeline exists**, and
they're the API-outage demo fallback §11 requires.

## Selection is configuration

One registry file maps port to adapter. Changing an adapter is one line. Resist
a plugin system or DI container — the whole mechanism fits on one screen.

**Useful consequence:** the demo build can pin fixture adapters for anything
that must not fail on stage, with no divergent code path.

## Enforcement

1. **ESLint `no-restricted-imports`** — `@tensorflow/*`, `@anthropic-ai/sdk`,
   direct `speechSynthesis` / `indexedDB` / `getUserMedia` access are importable
   **only** inside `src/adapters/**`. Ten minutes in Wave 0.
2. **One line on every review:** does this file import anything a vendor owns?

## Hosting is swappable too

1. Build output is a **plain static bundle** — no host-specific runtime.
2. All server-side work is **one function with one job**, reached via
   `VITE_API_BASE_URL`.
3. **Nothing in `src/` imports a hosting SDK.**

## The swap runbook

1. Write a new adapter against the existing port. If it doesn't fit, the port
   was modelled on the old vendor — fix that first.
2. Normalise at the boundary.
3. Change one registry line.
4. Re-run the consuming files' verifications.
5. **Re-check §13 and §14 for the new adapter specifically.** This step is not
   mechanical. A network face-detector would satisfy `FaceDetectPort` perfectly
   and break a §13 guarantee completely. **The port guarantees the interface,
   never the ethics.**

## Ownership

Ports are defined in **Wave 0**, by everyone, in about thirty minutes. Each
adapter is owned by whoever owns the file that consumes it — no change to any
assignment in the index.

| Ports | Owner |
|---|---|
| `StoragePort`, `TextGenPort` | P1, P3 |
| `CapturePort`, `FaceDetectPort`, `RedactionPort`, `VisionPort` | P2 |
| `SpeechOutPort` | P1 |

**Fixture adapters are written by the same owner, at the same time.** Five lines
each, and they're the reason the pattern works.
