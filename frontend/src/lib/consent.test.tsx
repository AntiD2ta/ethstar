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
import { act, render, renderHook, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ConsentProvider } from "./consent";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  useConsent,
} from "./consent-context";
import { ConsentBanner } from "@/components/consent-banner";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <ConsentProvider>{children}</ConsentProvider>
    </BrowserRouter>
  );
}

describe("ConsentProvider", () => {
  it("starts with no consent and banner open when localStorage is empty", () => {
    const { result } = renderHook(() => useConsent(), { wrapper: Wrapper });
    expect(result.current.consent).toBeNull();
    expect(result.current.bannerOpen).toBe(true);
  });

  it("acceptAll persists statistics=true and closes the banner", () => {
    const { result } = renderHook(() => useConsent(), { wrapper: Wrapper });
    act(() => result.current.acceptAll());
    expect(result.current.consent?.statistics).toBe(true);
    expect(result.current.bannerOpen).toBe(false);
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.statistics).toBe(true);
    expect(stored.version).toBe(CONSENT_VERSION);
    expect(stored.necessary).toBe(true);
  });

  it("rejectAll persists statistics=false and closes the banner", () => {
    const { result } = renderHook(() => useConsent(), { wrapper: Wrapper });
    act(() => result.current.rejectAll());
    expect(result.current.consent?.statistics).toBe(false);
    expect(result.current.bannerOpen).toBe(false);
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.statistics).toBe(false);
  });

  it("hydrates from localStorage on mount", () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        necessary: true,
        statistics: true,
        updatedAt: "2026-04-13T00:00:00.000Z",
      }),
    );
    const { result } = renderHook(() => useConsent(), { wrapper: Wrapper });
    expect(result.current.consent?.statistics).toBe(true);
    expect(result.current.bannerOpen).toBe(false);
  });

  it("re-prompts when the stored version does not match", () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: 0,
        necessary: true,
        statistics: true,
        updatedAt: "2026-04-13T00:00:00.000Z",
      }),
    );
    const { result } = renderHook(() => useConsent(), { wrapper: Wrapper });
    expect(result.current.consent).toBeNull();
    expect(result.current.bannerOpen).toBe(true);
  });

  it("re-prompts when the stored value is malformed", () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, "not json");
    const { result } = renderHook(() => useConsent(), { wrapper: Wrapper });
    expect(result.current.consent).toBeNull();
    expect(result.current.bannerOpen).toBe(true);
  });

  it("openBanner reopens after a choice was made", () => {
    const { result } = renderHook(() => useConsent(), { wrapper: Wrapper });
    act(() => result.current.rejectAll());
    expect(result.current.bannerOpen).toBe(false);
    act(() => result.current.openBanner());
    expect(result.current.bannerOpen).toBe(true);
  });

  it("savePreferences writes an explicit full record on first visit", () => {
    const { result } = renderHook(() => useConsent(), { wrapper: Wrapper });
    expect(result.current.consent).toBeNull();
    act(() => result.current.savePreferences({ statistics: true }));
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored).toMatchObject({
      version: CONSENT_VERSION,
      necessary: true,
      statistics: true,
    });
    expect(result.current.bannerOpen).toBe(false);
  });

  it("savePreferences with statistics=false persists a fresh record (not a merge)", () => {
    const { result } = renderHook(() => useConsent(), { wrapper: Wrapper });
    act(() => result.current.acceptAll());
    act(() => result.current.savePreferences({ statistics: false }));
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.statistics).toBe(false);
    expect(stored.necessary).toBe(true);
    expect(stored.version).toBe(CONSENT_VERSION);
  });
});

describe("ConsentBanner", () => {
  it("renders banner with three primary actions on first visit", () => {
    render(<ConsentBanner />, { wrapper: Wrapper });
    expect(screen.getByTestId("consent-accept")).toBeInTheDocument();
    expect(screen.getByTestId("consent-reject")).toBeInTheDocument();
    expect(screen.getByTestId("consent-preferences")).toBeInTheDocument();
  });

  it("Accept all persists statistics=true", async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />, { wrapper: Wrapper });
    await user.click(screen.getByTestId("consent-accept"));
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.statistics).toBe(true);
  });

  it("Reject all persists statistics=false", async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />, { wrapper: Wrapper });
    await user.click(screen.getByTestId("consent-reject"));
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.statistics).toBe(false);
  });

  it("Preferences swaps the view in the same dialog (no nested modal)", async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />, { wrapper: Wrapper });
    await user.click(screen.getByTestId("consent-preferences"));
    expect(screen.getByTestId("consent-preferences-dialog")).toBeInTheDocument();
    // The main-view action buttons are gone — only the preferences view is rendered.
    expect(screen.queryByTestId("consent-accept")).not.toBeInTheDocument();
    expect(screen.queryByTestId("consent-reject")).not.toBeInTheDocument();
    // Only one dialog is rendered in the DOM.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("Preferences → Cancel returns to the main view", async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />, { wrapper: Wrapper });
    await user.click(screen.getByTestId("consent-preferences"));
    await user.click(screen.getByTestId("consent-preferences-cancel"));
    expect(screen.getByTestId("consent-accept")).toBeInTheDocument();
    expect(screen.getByTestId("consent-reject")).toBeInTheDocument();
    expect(screen.queryByTestId("consent-preferences-dialog")).not.toBeInTheDocument();
  });

  it("Save preferences with statistics off writes a full record and closes the banner", async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />, { wrapper: Wrapper });
    await user.click(screen.getByTestId("consent-preferences"));
    await user.click(screen.getByTestId("consent-preferences-save"));
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored).toMatchObject({
      version: CONSENT_VERSION,
      necessary: true,
      statistics: false,
    });
    expect(screen.queryByTestId("consent-banner")).not.toBeInTheDocument();
  });

  it("main view is a non-modal bottom sheet, not a Dialog", () => {
    render(<ConsentBanner />, { wrapper: Wrapper });
    const banner = screen.getByTestId("consent-banner");
    // Bottom sheet: rendered as a <section>, not a dialog.
    expect(banner.tagName).toBe("SECTION");
    // No dialog is present on the main view — dialog mounts only when the
    // Preferences view is open.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Pinned to bottom via Tailwind utility class — fragile but catches a
    // regression to centered positioning.
    expect(banner.className).toContain("bottom-0");
    expect(banner.className).toContain("fixed");
  });
});
