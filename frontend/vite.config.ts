// Copyright © 2026 Miguel Tenorio Potrony - AntiD2ta.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    process.env.ANALYZE === "true" &&
      visualizer({ open: true, gzipSize: true, filename: "bundle-report.html" }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../web/static",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Pin three.js + its React bindings + postprocessing pipeline into a
        // single vendor chunk. The hero scene's dynamic import still splits
        // off its own small chunk; the heavy shared WebGL dependencies end
        // up in a stable vendor file that survives app-code deploys. On a
        // repeat visit the browser reuses the cached three-vendor file even
        // when the main app bundle's hash changes — worth an LCP drop of
        // ~300ms on warm-cache mobile loads.
        manualChunks(id) {
          if (
            id.includes("node_modules/three/") ||
            id.includes("node_modules/postprocessing/") ||
            id.includes("node_modules/@react-three/")
          ) {
            return "three-vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      // During development, proxy API calls to the Go backend.
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: "happy-dom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,integration.test}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,integration.test}.*",
        "src/test/**",
        "src/components/ui/**",
        "src/main.tsx",
        "src/shared/**",
      ],
    },
  },
});
