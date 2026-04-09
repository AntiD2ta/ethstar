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

import { ListPlus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { GitHubUser } from "@/lib/types";

interface AuthHeaderProps {
  user: GitHubUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function AuthHeader({
  user,
  isAuthenticated,
  isLoading,
  onLogin,
  onLogout,
}: AuthHeaderProps) {
  return (
    <header className="glass sticky top-0 z-50 flex items-center justify-between px-6 py-3">
      <nav aria-label="Site">
        <a
          href="/"
          className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight"
        >
          <img
            src="/logo-128.png"
            alt=""
            width={40}
            height={40}
            fetchPriority="high"
            className="h-10 w-10 rounded-full object-cover"
            aria-hidden="true"
          />
          <span>ethstar</span>
        </a>
      </nav>

      <a
        href="https://github.com/AntiD2ta/ethstar/blob/main/MAINTAINERS.md#repo-list-changes"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <ListPlus className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Propose more repos</span>
        <span className="sm:hidden">Propose</span>
      </a>

      {isLoading ? (
        <div className="flex items-center gap-3" role="status" aria-label="Loading account">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      ) : isAuthenticated && user ? (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarImage src={user.avatar_url} alt={user.login} />
            <AvatarFallback>
              {user.login.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-foreground/90">
            {user.name ?? user.login}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="rounded-full"
            aria-label="Sign out"
          >
            <LogOut aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <Button
          onClick={onLogin}
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Connect via GitHub
        </Button>
      )}
    </header>
  );
}
