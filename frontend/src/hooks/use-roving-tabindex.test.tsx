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

import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useRovingTabindex } from "./use-roving-tabindex";

function Harness({ items }: { items: string[] }) {
  const { tabIndexFor, onKeyDown, setCurrent } = useRovingTabindex(items.length);
  return (
    <ul data-roving-scope="test">
      {items.map((label, i) => (
        <li key={label}>
          <button
            type="button"
            data-testid={`btn-${label}`}
            data-roving-index={i}
            tabIndex={tabIndexFor(i)}
            onFocus={() => setCurrent(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {label}
          </button>
        </li>
      ))}
    </ul>
  );
}

describe("useRovingTabindex", () => {
  it("only the first item is tab-focusable by default", () => {
    render(<Harness items={["a", "b", "c"]} />);
    expect(screen.getByTestId("btn-a")).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("btn-b")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByTestId("btn-c")).toHaveAttribute("tabindex", "-1");
  });

  it("ArrowRight moves focus and tabIndex to the next sibling", async () => {
    const user = userEvent.setup();
    render(<Harness items={["a", "b", "c"]} />);
    const first = screen.getByTestId("btn-a");
    await act(async () => {
      first.focus();
    });
    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("btn-b")).toHaveFocus();
    expect(screen.getByTestId("btn-b")).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("btn-a")).toHaveAttribute("tabindex", "-1");
  });

  it("ArrowLeft on the first item wraps to the last", async () => {
    const user = userEvent.setup();
    render(<Harness items={["a", "b", "c"]} />);
    await act(async () => {
      screen.getByTestId("btn-a").focus();
    });
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("btn-c")).toHaveFocus();
  });

  it("ArrowRight on the last item wraps to the first", async () => {
    const user = userEvent.setup();
    render(<Harness items={["a", "b", "c"]} />);
    await act(async () => {
      screen.getByTestId("btn-c").focus();
      // setCurrent is bound to onFocus, but we want to drive state here
    });
    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("btn-a")).toHaveFocus();
  });

  it("Home/End jump to first/last", async () => {
    const user = userEvent.setup();
    render(<Harness items={["a", "b", "c", "d"]} />);
    await act(async () => {
      screen.getByTestId("btn-b").focus();
    });
    await user.keyboard("{End}");
    expect(screen.getByTestId("btn-d")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByTestId("btn-a")).toHaveFocus();
  });

  it("ignores non-arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness items={["a", "b"]} />);
    await act(async () => {
      screen.getByTestId("btn-a").focus();
    });
    await user.keyboard("x");
    expect(screen.getByTestId("btn-a")).toHaveFocus();
    expect(screen.getByTestId("btn-a")).toHaveAttribute("tabindex", "0");
  });

  it("with zero items, tabIndexFor(0) still returns 0 (no divide-by-zero wrap)", () => {
    // Edge case: an empty filter selection shouldn't make the first call crash.
    function Empty() {
      const { tabIndexFor } = useRovingTabindex(0);
      return <span data-testid="probe" data-tabindex={tabIndexFor(0)} />;
    }
    render(<Empty />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-tabindex", "0");
  });
});
