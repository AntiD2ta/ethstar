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

import { useRef } from "react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { StickyStarControls } from "./sticky-star-controls";

// Captures the latest IntersectionObserver callback so tests can fire entries.
let lastIOCallback: IntersectionObserverCallback | null = null;
let ioDisconnect = vi.fn();

beforeEach(() => {
  lastIOCallback = null;
  ioDisconnect = vi.fn();
  class FakeIO {
    constructor(cb: IntersectionObserverCallback) {
      lastIOCallback = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {
      ioDisconnect();
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  vi.stubGlobal("IntersectionObserver", FakeIO);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fireIntersect(isIntersecting: boolean) {
  act(() => {
    lastIOCallback?.(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

function Harness(props: {
  remaining: number;
  isStarring?: boolean;
  allDone?: boolean;
  hidden?: boolean;
  onStarAll?: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  return (
    <div>
      <section data-testid="fake-hero" ref={ref} />
      <StickyStarControls
        heroRef={ref}
        remaining={props.remaining}
        isStarring={props.isStarring ?? false}
        allDone={props.allDone ?? false}
        onStarAll={props.onStarAll ?? (() => {})}
        hidden={props.hidden}
      />
    </div>
  );
}

describe("StickyStarControls", () => {
  it("is not rendered while hero is still intersecting the viewport", () => {
    render(<Harness remaining={5} />);
    fireIntersect(true);
    expect(screen.queryByTestId("sticky-star-controls")).toBeNull();
  });

  it("mounts after the hero sentinel leaves the viewport", () => {
    render(<Harness remaining={5} />);
    fireIntersect(false);
    expect(screen.getByTestId("sticky-star-controls")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Star All 5 Remaining/i }),
    ).toBeInTheDocument();
  });

  it("hides when `hidden` is true (modal open)", () => {
    render(<Harness remaining={3} hidden={true} />);
    fireIntersect(false);
    expect(screen.queryByTestId("sticky-star-controls")).toBeNull();
  });

  it("hides once there are no remaining repos", () => {
    render(<Harness remaining={0} allDone={true} />);
    fireIntersect(false);
    expect(screen.queryByTestId("sticky-star-controls")).toBeNull();
  });

  it("disconnects observer on unmount", () => {
    const { unmount } = render(<Harness remaining={5} />);
    unmount();
    expect(ioDisconnect).toHaveBeenCalledTimes(1);
  });
});
