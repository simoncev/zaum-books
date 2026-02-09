import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    sourcemap: true,
  },

  plugins: [
    vue(),

    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",

      includeAssets: [
        "favicon.ico",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-192-maskable.png",
        "icons/icon-512-maskable.png",
      ],

      manifest: {
        name: "Books Reader",
        short_name: "BooksReader",
        description: "Book image reader",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },

      // Workbox present, but NO runtime caching rules
      workbox: {
        // Don’t apply SPA navigation fallback to API (good to keep)
        navigateFallbackDenylist: [/^\/api\//],

        // 🔥 no runtime caching at all
        runtimeCaching: [],

        // optional: keep SW small
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],

  server: {
    proxy: {
      "/api": {
        target: "https://simoncev.org:9999",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },

  base: "/",
});
