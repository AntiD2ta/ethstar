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

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Outlet, useNavigate } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/auth-context";
import {
  CommandPaletteContext,
  type CommandPaletteContextValue,
} from "@/hooks/command-palette-context";
import { REPOSITORIES } from "@/lib/repos";
import { onIdle } from "@/lib/webgl";

// Keep the main bundle lean — the palette only mounts on first open. The
// chunk is warmed on browser idle so first-open feels instant.
const CommandPalette = lazy(() =>
  import("@/components/command-palette").then((m) => ({
    default: m.CommandPalette,
  })),
);

export function RootLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, login, logout } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openPalette = useCallback(() => setPaletteOpen(true), []);

  // Global ⌘K / Ctrl+K. Capture-phase so inputs/textareas can't swallow it
  // — matches the pattern in roaming-star for window-level shortcuts.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "k" && e.key !== "K") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.altKey || e.shiftKey) return;
      e.preventDefault();
      setPaletteOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  // Warm the palette chunk on idle so the first open doesn't wait on a fresh
  // dynamic import. We deliberately don't assign to state — the import result
  // is cached by the bundler, and the lazy() factory reuses it on mount.
  useEffect(() => {
    return onIdle(() => {
      void import("@/components/command-palette");
    });
  }, []);

  const paletteCtx = useMemo<CommandPaletteContextValue>(
    () => ({ open: openPalette }),
    [openPalette],
  );

  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const onOpenExternal = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <CommandPaletteContext.Provider value={paletteCtx}>
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
        <Toaster />
        {paletteOpen && (
          <Suspense fallback={null}>
            <CommandPalette
              onClose={closePalette}
              isAuthenticated={isAuthenticated}
              repositories={REPOSITORIES}
              onNavigate={navigate}
              onOpenExternal={onOpenExternal}
              onLogin={login}
              onLogout={logout}
            />
          </Suspense>
        )}
      </div>
    </CommandPaletteContext.Provider>
  );
}
