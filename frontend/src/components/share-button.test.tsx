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

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareButton } from "./share-button";

// Canvas/Image rendering relies on browser APIs that happy-dom can't replicate
// (CanvasRenderingContext2D, Image onload, toBlob). Provide minimal stubs so
// the component mounts without errors; the full image pipeline is validated in
// browser sessions and Playwright E2E tests.
const fakeCtx = {
  createLinearGradient: () => ({ addColorStop: vi.fn() }),
  createRadialGradient: () => ({ addColorStop: vi.fn() }),
  fillRect: vi.fn(), fillText: vi.fn(), fill: vi.fn(),
  beginPath: vi.fn(), closePath: vi.fn(), arc: vi.fn(),
  lineTo: vi.fn(), moveTo: vi.fn(), roundRect: vi.fn(),
  drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(),
  measureText: () => ({ width: 100 }),
  set fillStyle(_v: unknown) { /* noop */ },
  set font(_v: unknown) { /* noop */ },
  set textAlign(_v: unknown) { /* noop */ },
  set textBaseline(_v: unknown) { /* noop */ },
  set shadowColor(_v: unknown) { /* noop */ },
  set shadowBlur(_v: unknown) { /* noop */ },
};

const realCreateElement = document.createElement.bind(document);

beforeEach(() => {
  vi.spyOn(document, "createElement").mockImplementation((tag: string, options?: ElementCreationOptions) => {
    if (tag === "canvas") {
      const el = realCreateElement("canvas", options);
      vi.spyOn(el, "getContext").mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);
      vi.spyOn(el, "toBlob").mockImplementation((cb) => { cb(new Blob(["x"], { type: "image/png" })); });
      return el;
    }
    return realCreateElement(tag, options);
  });

  vi.spyOn(globalThis, "Image").mockImplementation(() => {
    const img = realCreateElement("img") as HTMLImageElement;
    // Image never "loads" in happy-dom — accepted; preview stays in generating
    // state which is fine for testing button/dialog behavior.
    return img;
  });

  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

describe("ShareButton", () => {
  it("renders the share button with correct text", () => {
    render(<ShareButton starredCount={10} />);
    const btn = screen.getByRole("button", { name: /share/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeEnabled();
  });

  it("opens dialog with title and description when clicked", async () => {
    const user = userEvent.setup();
    render(<ShareButton starredCount={10} />);
    await user.click(screen.getByRole("button", { name: /share/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Share your support")).toBeInTheDocument();
    expect(screen.getByText(/copy or download this image/i)).toBeInTheDocument();
  });

  it("shows 'Generating preview' placeholder initially", async () => {
    const user = userEvent.setup();
    render(<ShareButton starredCount={10} />);
    await user.click(screen.getByRole("button", { name: /share/i }));

    expect(screen.getByText("Generating preview…")).toBeInTheDocument();
  });

  it("disables copy and download buttons while preview is generating", async () => {
    const user = userEvent.setup();
    render(<ShareButton starredCount={10} />);
    await user.click(screen.getByRole("button", { name: /share/i }));

    expect(screen.getByRole("button", { name: /copy image/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /download/i })).toBeDisabled();
  });

  it("dialog footer has copy and download buttons", async () => {
    const user = userEvent.setup();
    render(<ShareButton starredCount={7} />);
    await user.click(screen.getByRole("button", { name: /share/i }));

    expect(screen.getByRole("button", { name: /copy image/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
  });

  it("dialog can be closed via the close button", async () => {
    const user = userEvent.setup();
    render(<ShareButton starredCount={10} />);
    await user.click(screen.getByRole("button", { name: /share/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Click the close button (X)
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
