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

import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [["html"], ["list"]],

  use: {
    baseURL: isCI ? "http://localhost:8080" : "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // CI: run the pre-built production binary (serves API + embedded frontend on :8080).
  // Local: go run compiles the server + Vite dev server provides HMR on :5173.
  webServer: isCI
    ? [
        {
          command: "../bin/server",
          url: "http://localhost:8080/api/health",
          reuseExistingServer: false,
          timeout: 30_000,
        },
      ]
    : [
        {
          // Go API backend. Defaults to cmd/server; set E2E_USE_E2E_SERVER=1 to use cmd/e2eserver.
          command: process.env.E2E_USE_E2E_SERVER
            ? "cd .. && go run ./cmd/e2eserver"
            : "cd .. && go run ./cmd/server",
          url: "http://localhost:8080/api/health",
          reuseExistingServer: true,
          timeout: 30_000,
        },
        {
          command: "npm run dev",
          url: "http://localhost:5173",
          reuseExistingServer: true,
          timeout: 30_000,
        },
      ],
});
