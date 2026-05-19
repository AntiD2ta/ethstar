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
  Cookie,
  ExternalLink,
  Github,
  Home,
  ListPlus,
  LogOut,
  Shield,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { MAINTAINERS_URL } from "@/lib/constants";
import type { Repository } from "@/lib/types";

export interface CommandPaletteProps {
  /**
   * Called when the user dismisses the palette (Esc, click outside, or
   * selecting an item). The parent should unmount the component in response.
   */
  onClose: () => void;
  isAuthenticated: boolean;
  repositories: Repository[];
  onNavigate: (path: string) => void;
  onOpenExternal: (url: string) => void;
  onLogin: () => void;
  onLogout: () => void;
}

export function CommandPalette({
  onClose,
  isAuthenticated,
  repositories,
  onNavigate,
  onOpenExternal,
  onLogin,
  onLogout,
}: CommandPaletteProps) {
  const navigateAndClose = (path: string) => {
    onNavigate(path);
    onClose();
  };

  const openExternalAndClose = (url: string) => {
    onOpenExternal(url);
    onClose();
  };

  return (
    <CommandDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Command palette"
      description="Search routes, actions, or repositories"
    >
      <CommandInput placeholder="Search routes, actions, or repositories…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem
            value="Home"
            keywords={["home", "index", "root"]}
            onSelect={() => navigateAndClose("/")}
          >
            <Home aria-hidden="true" />
            <span>Home</span>
          </CommandItem>
          <CommandItem
            value="Privacy"
            keywords={["privacy", "policy", "legal"]}
            onSelect={() => navigateAndClose("/privacy")}
          >
            <Shield aria-hidden="true" />
            <span>Privacy</span>
          </CommandItem>
          <CommandItem
            value="Cookies"
            keywords={["cookies", "policy", "legal"]}
            onSelect={() => navigateAndClose("/cookies")}
          >
            <Cookie aria-hidden="true" />
            <span>Cookies</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Account">
          {isAuthenticated ? (
            <CommandItem
              value="Sign out"
              keywords={["logout", "sign-out", "leave"]}
              onSelect={() => {
                onLogout();
                onClose();
              }}
            >
              <LogOut aria-hidden="true" />
              <span>Sign out</span>
            </CommandItem>
          ) : (
            <CommandItem
              value="Sign in with GitHub"
              keywords={["login", "sign-in", "authenticate", "github"]}
              onSelect={() => {
                onLogin();
                onClose();
              }}
            >
              <Github aria-hidden="true" />
              <span>Sign in with GitHub</span>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandGroup heading="Actions">
          <CommandItem
            value="Propose more repos"
            keywords={["propose", "maintainers", "repo", "add", "suggest"]}
            onSelect={() => openExternalAndClose(MAINTAINERS_URL)}
          >
            <ListPlus aria-hidden="true" />
            <span>Propose more repos</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Repositories">
          {repositories.map((repo) => {
            const slug = `${repo.owner}/${repo.name}`;
            return (
              <CommandItem
                key={slug}
                // Match only on `owner/name` — fuzzy-matching descriptions
                // scored unrelated repos above exact-name hits (e.g. typing
                // "go-ethereum" ranked "go-eth2-client" first via shared
                // letters in its description).
                value={slug}
                onSelect={() => openExternalAndClose(repo.url)}
              >
                <ExternalLink aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-foreground">
                    {slug}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {repo.description}
                  </span>
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
