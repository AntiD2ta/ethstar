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
import { render } from "@testing-library/react";
import { StarShape } from "./star-shape";

function getClipRect(container: HTMLElement): SVGRectElement {
  const rect = container.querySelector("clipPath rect");
  if (!rect) throw new Error("clip rect not found");
  return rect as SVGRectElement;
}

describe("StarShape", () => {
  it("renders with an SVG viewBox", () => {
    const { container } = render(
      <StarShape size={56} fillLevel={0} status="disconnected" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 100 100");
  });

  it("clips the gold fill from the bottom (fillLevel=0 → clip height 0)", () => {
    const { container } = render(
      <StarShape size={56} fillLevel={0} status="disconnected" />,
    );
    const rect = getClipRect(container);
    expect(rect.getAttribute("y")).toBe("100");
    expect(rect.getAttribute("height")).toBe("0");
  });

  it("fillLevel=0.5 → half-filled from bottom", () => {
    const { container } = render(
      <StarShape size={56} fillLevel={0.5} status="ready" />,
    );
    const rect = getClipRect(container);
    expect(rect.getAttribute("y")).toBe("50");
    expect(rect.getAttribute("height")).toBe("50");
  });

  it("fillLevel=1 → fully filled", () => {
    const { container } = render(
      <StarShape size={56} fillLevel={1} status="success" />,
    );
    const rect = getClipRect(container);
    expect(rect.getAttribute("y")).toBe("0");
    expect(rect.getAttribute("height")).toBe("100");
  });

  it("clamps fillLevel to [0, 1]", () => {
    const { container: belowZero } = render(
      <StarShape size={56} fillLevel={-0.5} status="disconnected" />,
    );
    const rect1 = getClipRect(belowZero);
    expect(rect1.getAttribute("height")).toBe("0");

    const { container: aboveOne } = render(
      <StarShape size={56} fillLevel={2.5} status="success" />,
    );
    const rect2 = getClipRect(aboveOne);
    expect(rect2.getAttribute("height")).toBe("100");
  });

  it("renders the flare only when flaring=true", () => {
    const { container: off } = render(
      <StarShape size={56} fillLevel={0.3} status="ready" flaring={false} />,
    );
    expect(off.querySelector("circle")).toBeNull();

    const { container: on } = render(
      <StarShape size={56} fillLevel={0.3} status="ready" flaring={true} />,
    );
    expect(on.querySelector("circle")).toBeTruthy();
  });

  it("uses a warm stroke color on partial-failure status", () => {
    const { container } = render(
      <StarShape size={56} fillLevel={0.5} status="partial-failure" />,
    );
    // The outline stroke is the 2nd path (fill path is first, outline on top).
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(2);
    const outline = paths[paths.length - 1]!;
    const stroke = outline.getAttribute("stroke") ?? "";
    // Warm purple-red stroke (oklch with hue ~340).
    expect(stroke).toContain("oklch");
    expect(stroke).toContain("340");
  });
});
