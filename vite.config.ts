/// <reference types="node" />
import { defineConfig, loadEnv, type ConfigEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default async (env: ConfigEnv) => {
  const loaded = loadEnv(env.mode, process.cwd(), "");
  const apiTarget = (loaded.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

  // Vite only auto-inlines VITE_* vars into the client bundle; the SSR/server
  // bundle needs them defined explicitly too, so both see the same values.
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadEnv(env.mode, process.cwd(), "VITE_"))) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return defineConfig({
    define: envDefine,
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        spa: { enabled: true },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      viteReact(),
    ],
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: false },
        "/ws": { target: apiTarget, ws: true, changeOrigin: false },
      },
      watch: {
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 },
      },
    },
  });
};
