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

/* eslint-disable react-refresh/only-export-components */
import type { ReactElement, ReactNode } from "react";
import { render, renderHook } from "@testing-library/react";
import type { RenderHookOptions, RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "@/hooks/use-auth";
import type { GitHubUser } from "@/lib/types";

export const STORAGE_KEY = "ethstar_auth";

export interface SeedAuth {
  access_token: string;
  expires_at?: number;
  refresh_token?: string;
  user?: GitHubUser | null;
}

/** Seed localStorage before the AuthProvider initializes. */
export function seedAuth(seed: SeedAuth | null): void {
  if (!seed) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      access_token: seed.access_token,
      expires_at: seed.expires_at ?? Date.now() + 3600_000,
      refresh_token: seed.refresh_token ?? "",
      user: seed.user ?? null,
    }),
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  );
}

export interface RenderWithAuthOptions extends Omit<RenderOptions, "wrapper"> {
  seed?: SeedAuth | null;
}

export function renderWithAuth(
  ui: ReactElement,
  opts: RenderWithAuthOptions = {},
) {
  const { seed, ...rest } = opts;
  if (seed !== undefined) seedAuth(seed);
  return render(ui, { wrapper: Wrapper, ...rest });
}

export interface RenderHookWithAuthOptions<TProps>
  extends Omit<RenderHookOptions<TProps>, "wrapper"> {
  seed?: SeedAuth | null;
}

export function renderHookWithAuth<TResult, TProps>(
  callback: (props: TProps) => TResult,
  opts: RenderHookWithAuthOptions<TProps> = {},
) {
  const { seed, ...rest } = opts;
  if (seed !== undefined) seedAuth(seed);
  return renderHook(callback, { wrapper: Wrapper, ...rest });
}
