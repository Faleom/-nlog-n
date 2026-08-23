# Adapters

One subdirectory per port. This is the **only** place a vendor SDK
(`@tensorflow/*`, `@anthropic-ai/sdk`, direct `speechSynthesis` /
`indexedDB` / `getUserMedia` access) may be imported — enforced by the
`no-restricted-imports` rule in `.oxlintrc.json`.

| Directory | Port | Real adapter (write here) | Owner | Feature file |
|---|---|---|---|---|
| `capture/` | `CapturePort` | `deviceCamera.ts` | P2 | F.006 |
| `face/` | `FaceDetectPort` | `blazeFaceLocal.ts` — **never a network adapter** | P2 | F.006 |
| `redaction/` | `RedactionPort` | `canvasMosaic.ts` | P2 | F.006 |
| `vision/` | `VisionPort` | `claudeVision.ts` | P2 | F.006 |
| `textgen/` | `TextGenPort` | `haikuCard.ts`, `rawTextCard.ts` | P3 | F.015 |
| `speech/` | `SpeechOutPort` | `webSpeechOut.ts` | P1 | F.010 |
| `storage/` | `StoragePort` | `indexedDbStorage.ts` | P1 | F.001 |
| `sound/` | `SoundPort` | `webClickSound.ts` — synthesised via Web Audio, no asset file | — | app-wide button tap feedback |
| `fixtures/` | all of the above | already written — see `ports.ts` | — | — |

**When your real adapter is ready:** write it in your subdirectory, then swap
one line in `registry.ts`. Nothing else in the codebase changes.

See `../../plan/engineering/ARCHITECTURE-RULES.md` for the full rule and the
swap runbook.
