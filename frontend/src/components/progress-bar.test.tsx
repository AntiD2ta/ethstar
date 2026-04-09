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

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  it("has aria-live=polite on the current-repo text", () => {
    render(
      <ProgressBar progress={{ total: 10, starred: 3, remaining: 7, current: "repo" }} />,
    );
    const liveEl = screen.getByText(/Starring repo/);
    expect(liveEl).toHaveAttribute("aria-live", "polite");
  });

  it("renders correct progress bar ARIA values", () => {
    render(
      <ProgressBar progress={{ total: 17, starred: 5, remaining: 12, current: "go-ethereum" }} />,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "5");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "17");
    expect(bar).toHaveAttribute("aria-label", "Starring progress");
  });
});
