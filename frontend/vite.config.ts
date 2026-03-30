/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../web/static",
    emptyOutDir: true,
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
