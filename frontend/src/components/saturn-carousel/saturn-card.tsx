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

import { memo, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Loader2, Star } from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { formatStarCount } from "@/lib/utils";
import { repoKey } from "@/lib/repo-key";
import type { Repository, StarStatus } from "@/lib/types";

interface SaturnCardProps {
  repo: Repository;
  status: StarStatus;
  starCount?: number;
  liveDescription?: string | null;
  metaLoading?: boolean;
  /** Primary action: jump to the matching marquee card. */
  onJump?: (repo: Repository) => void;
  /** Secondary action (shift+click menu item): trigger the star flow. */
  onStarTrigger?: (repo: Repository) => void;
  tabIndex?: number;
  rovingIndex?: number;
  onRovingKeyDown?: (
    event: KeyboardEvent<HTMLElement>,
    index: number,
  ) => void;
  onRovingFocus?: (index: number) => void;
}

export const SaturnCard = memo(function SaturnCard({
  repo,
  status,
  starCount,
  liveDescription,
  metaLoading,
  onJump,
  onStarTrigger,
  tabIndex,
  rovingIndex,
  onRovingKeyDown,
  onRovingFocus,
}: SaturnCardProps) {
  const description = liveDescription ?? repo.description;
  const [menuOpen, setMenuOpen] = useState(false);
  const key = repoKey(repo);
  const statusWord = status === "starred" ? "starred" : "not starred";

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (e.shiftKey) {
      setMenuOpen(true);
      return;
    }
    onJump?.(repo);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLAnchorElement>) => {
    if (rovingIndex != null) {
      onRovingKeyDown?.(e, rovingIndex);
      if (e.defaultPrevented) return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.shiftKey) {
        setMenuOpen(true);
        return;
      }
      onJump?.(repo);
    }
  };

  const handleFocus = () => {
    if (rovingIndex != null) onRovingFocus?.(rovingIndex);
  };

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverAnchor asChild>
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="saturn-card group"
          title={`${key} — ${statusWord}`}
          aria-label={`${key}, ${statusWord}`}
          data-roving-index={rovingIndex}
          tabIndex={tabIndex}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-heading text-xs font-semibold leading-tight text-primary group-hover:underline">
              {repo.owner}/{repo.name}
            </h3>
            <CompactStarIndicator status={status} />
          </div>

          {metaLoading && !liveDescription ? (
            <Skeleton className="h-3 w-full rounded" />
          ) : (
            <p className="line-clamp-1 text-[11px] leading-snug text-muted-foreground">
              {description}
            </p>
          )}

          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <img
                src={`https://github.com/${repo.owner}.png?size=32`}
                alt={repo.owner}
                className="size-4 rounded-full"
              />
              <span className="text-[10px] text-muted-foreground">
                {repo.owner}
              </span>
            </div>
            {typeof starCount === "number" ? (
              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Star size={9} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                <span>{formatStarCount(starCount)}</span>
              </div>
            ) : metaLoading ? (
              <Skeleton className="h-3 w-8 rounded" />
            ) : null}
          </div>
        </a>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={6}
        className="w-48 p-1"
      >
        {/* role="group" keeps the two actions semantically paired without
            promising arrow-key menu navigation. A full DropdownMenu swap is
            tracked in TASKS.md as a follow-up. */}
        <div role="group" aria-label={`${key} actions`} className="flex flex-col">
          <button
            type="button"
            className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              setMenuOpen(false);
              onStarTrigger?.(repo);
            }}
          >
            Star
          </button>
          <a
            href={repo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => setMenuOpen(false)}
          >
            Open on GitHub
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
});

function CompactStarIndicator({ status }: { status: StarStatus }) {
  if (status === "checking") {
    return <Skeleton className="size-4 shrink-0 rounded-full" aria-label="Checking" />;
  }
  if (status === "starring") {
    return (
      <Loader2
        className="shrink-0 animate-spin text-primary motion-reduce:animate-none"
        size={14}
        aria-label="Starring"
      />
    );
  }
  if (status === "starred") {
    return (
      <Star
        className="shrink-0 text-star-gold"
        fill="currentColor"
        strokeWidth={0}
        size={14}
        aria-label="Starred"
      />
    );
  }
  if (status === "failed") {
    return (
      <Star className="shrink-0 text-destructive" size={14} aria-label="Failed" />
    );
  }
  // unstarred or unknown
  return (
    <Star
      className="shrink-0 text-muted-foreground"
      size={14}
      aria-label={status === "unstarred" ? "Not starred" : "Unknown"}
    />
  );
}
