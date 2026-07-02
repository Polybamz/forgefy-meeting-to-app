// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
/// <reference types="node" />
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type ConfigEnv } from "vite";

export default async (env: ConfigEnv) => {
  const loaded = loadEnv(env.mode, process.cwd(), "");
  const apiTarget = (loaded.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

  return defineConfig({
    cloudflare: false,
    tanstackStart: {
      spa: { enabled: true },
    },
    vite: {
      server: {
        proxy: {
          "/api": { target: apiTarget, changeOrigin: false },
          "/ws": { target: apiTarget, ws: true, changeOrigin: false },
        },
      },
    },
  })(env);
};
