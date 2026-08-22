import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// See plan/engineering/TECH-DECISIONS.md "Storage" and "Demo-day
// resilience" — the service worker is what lets an already-generated
// session run fully offline (§7.10).
export default defineConfig({
  plugins: [
    react(),
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
});
