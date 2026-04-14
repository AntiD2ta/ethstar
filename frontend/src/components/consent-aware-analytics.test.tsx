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

import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import type { ReactNode } from "react";

const analyticsSpy = vi.fn(() => ({
  Analytics: () => <span data-testid="mock-analytics" />,
}));
const speedInsightsSpy = vi.fn(() => ({
  SpeedInsights: () => <span data-testid="mock-speed-insights" />,
}));

vi.mock("@vercel/analytics/react", () => analyticsSpy());
vi.mock("@vercel/speed-insights/react", () => speedInsightsSpy());

import { ConsentAwareAnalytics } from "./consent-aware-analytics";
import { ConsentProvider } from "@/lib/consent";
import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from "@/lib/consent-context";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <ConsentProvider>{children}</ConsentProvider>
    </BrowserRouter>
  );
}

describe("ConsentAwareAnalytics", () => {
  it("does not render or import analytics when statistics consent is missing", async () => {
    const { container } = render(<ConsentAwareAnalytics />, { wrapper: Wrapper });
    await Promise.resolve();
    expect(container.innerHTML).toBe("");
    expect(analyticsSpy).not.toHaveBeenCalled();
    expect(speedInsightsSpy).not.toHaveBeenCalled();
  });

  it("does not render when statistics consent is false", async () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        necessary: true,
        statistics: false,
        updatedAt: "2026-04-13T00:00:00.000Z",
      }),
    );
    const { container } = render(<ConsentAwareAnalytics />, { wrapper: Wrapper });
    await Promise.resolve();
    expect(container.innerHTML).toBe("");
    expect(analyticsSpy).not.toHaveBeenCalled();
    expect(speedInsightsSpy).not.toHaveBeenCalled();
  });

  it("renders analytics when statistics consent is true", async () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        necessary: true,
        statistics: true,
        updatedAt: "2026-04-13T00:00:00.000Z",
      }),
    );
    const { findByTestId } = render(<ConsentAwareAnalytics />, { wrapper: Wrapper });
    await waitFor(() => findByTestId("mock-analytics"));
    await waitFor(() => findByTestId("mock-speed-insights"));
    expect(analyticsSpy).toHaveBeenCalled();
    expect(speedInsightsSpy).toHaveBeenCalled();
  });
});
