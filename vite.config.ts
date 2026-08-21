// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  plugins: [
    VitePWA({
      strategies: "generateSW",
      // "prompt": the reload is user-triggered so an active ride is never
      // interrupted by a destructive automatic refresh.
      registerType: "prompt",
      // The registration wrapper in src/lib/pwa/register-sw.ts is the only registrar.
      injectRegister: null,
      // Never emit/register a service worker in dev or Lovable preview.
      devOptions: { enabled: false },
      // The manifest is a static, same-origin file in public/.
      manifest: false,
      filename: "sw.js",
      // The Nitro/Cloudflare build serves static files from dist/client.
      outDir: "dist/client",
      workbox: {
        globPatterns: ["**/*.{js,css,woff,woff2,png,svg,ico,webmanifest,html}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Updates are applied only when the app decides it is safe to reload.
        skipWaiting: false,
        navigateFallback: null,
        runtimeCaching: [
          {
            // HTML navigations: always try the network first, fall back to the
            // cached shell (and finally the offline page) only when offline.
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "zuvvi-html",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 25, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Same-origin hashed build assets, fonts, icons and images.
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin &&
              !url.pathname.startsWith("/api/") &&
              !url.pathname.startsWith("/~oauth") &&
              ["style", "script", "worker", "font", "image"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "zuvvi-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
