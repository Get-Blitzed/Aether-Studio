import fs from "node:fs";
import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

// Workspace packages ship TypeScript source as their "main" entry (no build
// step of their own), so they must be bundled -- not externalized -- into
// the main/preload output, or Node tries to `require()` raw .ts/ESM syntax.
const workspacePackages = [
  "@aether/ai-providers",
  "@aether/core",
  "@aether/database",
  "@aether/media-engine",
  "@aether/plugin-sdk",
  "@aether/project-engine",
  "@aether/shared-types",
];

// @aether/database reads its migration .sql files from disk at runtime
// (relative to its own compiled location), so the bundler must copy them
// alongside the bundled main output -- Rollup only follows JS imports, not
// fs.readFileSync paths.
function copyMigrationsPlugin(): Plugin {
  return {
    name: "copy-aether-migrations",
    apply: "build",
    closeBundle() {
      const from = resolve(__dirname, "../../packages/database/src/migrations");
      const to = resolve(__dirname, "out/main/migrations");
      fs.mkdirSync(to, { recursive: true });
      for (const file of fs.readdirSync(from)) {
        fs.copyFileSync(resolve(from, file), resolve(to, file));
      }
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages }), copyMigrationsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "src/main/index.ts"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "src/preload/index.ts"),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    build: {
      rollupOptions: {
        input: resolve(__dirname, "src/renderer/index.html"),
      },
    },
    plugins: [react()],
  },
});
