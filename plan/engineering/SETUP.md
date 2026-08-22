# Setup — all four machines

Do this together in **Wave 0**, before anyone starts F.001 or F.006. Four people
discovering four different setup problems mid-build is a bad use of the window.

## The short version

A **mobile web app** (React + TypeScript + Vite, PWA) plus **one serverless
function** that holds the API key. No database, no accounts, no native build.

**One account required:** an Anthropic API key. Two models (§0 / TECH-DECISIONS):
`claude-sonnet-5` for the room photo, `claude-haiku-4-5` for the Branch 2 card.

## 1. Tooling

| Tool | Check |
|---|---|
| **Node.js 20+** | `node -v` |
| **npm** | `npm -v` |
| **Git** | `git --version` |
| **A real tablet** | §4.4 — required, not optional |
| **A real phone** | §4.4 — required, not optional |

```bash
git clone <repo> && cd <repo> && npm install && npm run dev
```

Open the printed URL. Shell renders → toolchain done.

> **Get both devices on the dev server in Wave 0.** Devtools emulation is not
> sufficient for touch-target sizing, and 88×88pt is a hard floor. You need to
> be able to load a build on real hardware in seconds, all weekend.

## 2. The API key

1. One person creates it at `console.anthropic.com`.
2. **Set a spend cap immediately**, not later.
3. It lives in exactly two places: that person's local `.env`, and the host's
   environment variables. **Never committed, never in the browser bundle.**

Everything else needs no account: face detection (local), speech (browser
built-in), storage (browser built-in), camera (browser built-in).

## 3. Secrets

- **`.env.example`** committed, with fake values. The only env file in git.
- **`.env`** local, real values, in `.gitignore` **before any key exists**.
- Production values in the host's dashboard.

```
# Server-side only. Never prefixed with VITE_.
ANTHROPIC_API_KEY=sk-ant-REPLACE-ME

# Client-side, deliberately. This is what makes the host swappable.
VITE_API_BASE_URL=/api
```

> **Any `VITE_`-prefixed variable is inlined into the bundle and is public.**
> Readable in view-source. The Anthropic key must never carry that prefix. If
> you find yourself needing the key in browser code, the architecture is wrong —
> the browser calls the function, the function calls Anthropic.

Before the first push: confirm `.gitignore` has `.env`, run `git status`.

## 4. Smoke tests

| Dependency | Test |
|---|---|
| Vite + React + TS | `npm run dev` → shell renders |
| TypeScript | `npx tsc --noEmit` → exits 0 |
| `@tensorflow/tfjs` | Console: `await tf.ready(); tf.getBackend()` → `"webgl"` |
| `blazeface` | Photo of a teammate's face → ≥1 bounding box |
| **Camera** | On the **real tablet**, tap capture → viewfinder opens, photo lands on canvas |
| **Claude vision** | Shoot your desk → labels like `mug`, `notebook`. **Then check the network request body: is the image blurred?** |
| **Crop quality** | Cut crops from the returned bboxes. **Are they recognisable?** If not, read the bbox-precision section in `TECH-DECISIONS.md` — this is the top risk after face blur |
| Claude text | `curl` the proxy with a short prompt → a completion |
| `speechSynthesis` | Console `speak(...)` → audible. Wait for `voiceschanged`; on iOS, tap something first |
| IndexedDB | `await navigator.storage.persist()` → `true` |
| ESLint port rule | Import `@anthropic-ai/sdk` outside `src/adapters/` → **lint fails** |
| Offline | DevTools → Offline → an already-generated session still runs |
| Function | `curl` the deployed URL → completion. Then `grep -r "sk-ant" dist/` → **nothing** |

## 5. Hosting

Host is **deferred** — free tier during the build, possibly a paid host and a
domain later. Three rules from the first commit keep that reversible:

1. Build output is a **plain static bundle**
2. Server-side work is **one function**, reached via `VITE_API_BASE_URL`
3. **No hosting SDK in `src/`**

> A static-only host cannot work alone: the key needs a function, and GitHub
> Pages can't run one. Everything else stays open.

## 6. Wave 0 checklist

- [ ] Node 20+, `npm install` clean, dev server renders — all four machines
- [ ] **Real tablet and real phone loading the dev server**
- [ ] `.gitignore` has `.env`; `.env.example` committed
- [ ] API key created, **spend cap set**, function deployed
- [ ] `grep -r "sk-ant" dist/` returns nothing
- [ ] **Everyone watches one photo go over the wire and confirms it's blurred**
- [ ] Crops from real bboxes are recognisable
- [ ] Ports defined + lint rule verified to actually fail
- [ ] Crop tag shape and slot list agreed — everyone can state both
- [ ] §13 skimmed together
- [ ] Everyone can say the privacy line: *"faces blurred in the browser before
      anything is sent; the photo is processed and discarded, never stored; the
      only image that persists is the toy"*
