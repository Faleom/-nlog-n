import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `npm run dev` is plain Vite — there is no host that serves api/claude.ts
// the way Vercel does in production. Without this, every capture in local
// dev silently 404s and falls back to GENERIC_FALLBACK_CROPS, which looks
// identical to a real miss (§11's fallback is deliberately quiet) — so
// nobody notices vision isn't actually running. This plugin loads
// api/claude.ts's own handler straight into the dev server (same file,
// same code path production uses) so `npm run dev` alone is enough to
// demo real detection. Dev-only: never included in `vite build`.
function apiDevProxy(): Plugin {
  return {
    name: 'api-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/claude', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }
        const chunks: Uint8Array[] = [];
        req.on('data', (chunk: Uint8Array) => chunks.push(chunk));
        req.on('end', () => {
          void (async () => {
            const startedAt = Date.now();
            try {
              const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
              const kind = (body as { kind?: string }).kind ?? 'unknown';
              // Logged because the app's §11 fallback is deliberately SILENT
              // — a failed vision call degrades to generic crops with no
              // error shown, which is right for a caregiver mid-session and
              // useless when you are trying to work out why detection isn't
              // running. This is the only place that can say so out loud.
              server.config.logger.info(`[api] ${kind} request received`);
              const mod = await server.ssrLoadModule('/api/claude.ts');
              const handler = (mod as { default: (req: unknown, res: unknown) => Promise<void> }).default;
              await handler(
                { method: req.method, body },
                {
                  status(code: number) {
                    res.statusCode = code;
                    return this;
                  },
                  json(payload: unknown) {
                    const ms = Date.now() - startedAt;
                    const text = JSON.stringify(payload);
                    if (res.statusCode >= 400) {
                      server.config.logger.error(`[api] ${kind} FAILED ${res.statusCode} in ${ms}ms: ${text.slice(0, 300)}`);
                    } else {
                      // Count what the model actually returned, so "ran but
                      // found nothing" is distinguishable from "never ran".
                      const found = (text.match(/\\"name\\":/g) ?? []).length;
                      server.config.logger.info(`[api] ${kind} ok in ${ms}ms — ${found} object(s) returned`);
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.end(text);
                  },
                },
              );
            } catch (err) {
              server.config.logger.error(`[api] dev proxy threw: ${String(err)}`);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'dev proxy failed', detail: String(err) }));
            }
          })();
        });
      });
    },
  };
}

// See plan/engineering/TECH-DECISIONS.md "Storage" and "Demo-day
// resilience" — the service worker is what lets an already-generated
// session run fully offline (§7.10).
// NOTE for whoever reads this next: two of us independently built the
// exact same fix the same night -- a dev-only proxy for api/claude.ts,
// because plain `vite` has no route for it and every capture in local dev
// was silently falling back to generic content with nothing on screen to
// say why. This kept the more instrumented of the two versions (the one
// above, apiDevProxy) since it logs request kind/timing/status/object
// count -- genuinely useful for exactly the "why did this silently fail"
// problem that motivated building it in the first place. The other
// version (functionally equivalent, just without the logging) is in this
// file's git history if it's ever useful for comparison.
export default defineConfig(({ mode, command }) => {
  // api/claude.ts reads process.env.ANTHROPIC_API_KEY directly (correct --
  // it's server-only, never VITE_-prefixed, never bundled to the client).
  // loadEnv() is what actually reads .env's non-VITE_ keys at config time;
  // plain `process.env` on its own would not see them.
  const env = loadEnv(mode, process.cwd(), '');
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

  return {
    plugins: [
      react(),
      command === 'serve' && apiDevProxy(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'App Guide v3 Project',
          short_name: 'AppGuideV3',
          start_url: '/',
          display: 'standalone',
          orientation: 'portrait', // §4.3 — phone locks to portrait
          background_color: '#ffffff',
          theme_color: '#ffffff',
          icons: [],
        },
        workbox: {
          // Precache the app shell + the BlazeFace model once F.006 lands.
          // Room photos and vision calls are never cached — they're
          // transient by design (§14).
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        },
      }),
    ],
  };
});
