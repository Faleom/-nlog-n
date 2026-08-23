import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// See plan/engineering/TECH-DECISIONS.md "Storage" and "Demo-day
// resilience" — the service worker is what lets an already-generated
// session run fully offline (§7.10).

/**
 * Dev-only local proxy for api/claude.ts.
 *
 * In production this file deploys as a real serverless function (Vercel
 * auto-detects anything under api/) — nothing about that changes. But
 * `npm run dev` is plain `vite`, which has no route for `/api/claude` at
 * all: there was never a local way to actually exercise the vision, card,
 * or story generation calls through the real running browser app. Every
 * "real API" verification in this repo (scripts/verify-*-live.ts) calls
 * the Anthropic SDK directly in Node, bypassing this fetch()/proxy path
 * entirely -- which meant the actual click-through path had literally
 * never been proven to work, and every failure silently degraded to
 * generic fallback content by design, indistinguishable from success at
 * a glance. This plugin closes that gap for local dev, using Vite's own
 * `ssrLoadModule` (not a plain dynamic import) specifically because
 * api/claude.ts is untranspiled TypeScript -- ssrLoadModule runs it
 * through Vite's own transform pipeline instead of requiring a separate
 * TS loader registered on the `vite` process itself.
 */
function claudeApiDevProxy(): Plugin {
  return {
    name: 'claude-api-dev-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/claude', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk as Buffer);
          }
          const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));

          const mod = await server.ssrLoadModule('/api/claude.ts');
          const handler = (mod as { default: (req: unknown, res: unknown) => Promise<void> })
            .default;

          let statusCode = 200;
          await handler(
            { method: req.method, body },
            {
              status(code: number) {
                statusCode = code;
                return this;
              },
              json(payload: unknown) {
                res.statusCode = statusCode;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(payload));
              },
            },
          );
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'dev proxy failed', detail: String(err) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // api/claude.ts reads process.env.ANTHROPIC_API_KEY directly (correct --
  // it's server-only, never VITE_-prefixed, never bundled to the client).
  // loadEnv() is what actually reads .env's non-VITE_ keys at config time;
  // plain `process.env` on its own would not see them.
  const env = loadEnv(mode, process.cwd(), '');
  if (env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  }

  return {
    plugins: [
      react(),
      claudeApiDevProxy(),
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
