// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
/// <reference types="node" />
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default async (env: { mode: string; command: string }) => {
  const loaded = loadEnv(env.mode, process.cwd(), "");
  const apiTarget = (loaded.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

  return defineConfig({
    tanstackStart: {
      server: { entry: "server" },
    },
    vite: {
      server: {
        proxy: {
          "/api": { target: apiTarget, changeOrigin: false },
          "/ws": { target: apiTarget, ws: true, changeOrigin: false },
        },
      },
    }
  })(env);
};
