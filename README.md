# Hello World
*Melbourne Hack 2026 · Accessible Education track · SDG 4*

An early-learning app for children aged 3–7 who are pre-literate and pre- or
minimally verbal, autistic, ADHD, or still on a diagnosis waiting list. Two
branches: **My World** turns a photo of the child's own room into activities
built from their real objects, and **Worry to Question** turns a parent's
vague concern into a clear question for a health worker, without ever
screening or diagnosing.

The app lives in [`app/`](app/) | Vite + React + TypeScript, a mobile-web PWA.

## Try it now

**[helloworld-alpha-tawny.vercel.app](https://helloworld-alpha-tawny.vercel.app)**

No setup needed, open the link on your phone or browser and the app runs fully, including camera and AI features.

## Running it locally

Local setup requires an Anthropic API key, which is not included in the repository. We recommend using the Vercel link above instead.

If you do need to run it locally:
```
cd app
npm install
cp .env.example .env   # then fill in ANTHROPIC_API_KEY
npm run dev
```

`ANTHROPIC_API_KEY` is server-only, read by the one serverless function at
`app/api/claude.ts` , it's never bundled into the client. See
`app/.env.example` for both variables the app reads.

## Building / deploying

```
npm run build
```

Deploys cleanly to Vercel: import the repo, set the project's **Root
Directory** to `app`, and add `ANTHROPIC_API_KEY` as an environment variable.
Everything else (framework, build command, output directory) auto-detects.
