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
import { Star } from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { repoKey } from "@/lib/repo-key";
import type { Repository, StarStatus } from "@/lib/types";

interface SaturnChipProps {
  repo: Repository;
  status: StarStatus;
  /** Primary action: jump to the matching marquee card. */
  onJump?: (repo: Repository) => void;
  /** Secondary action (shift+click menu item): trigger the star flow. */
  onStarTrigger?: (repo: Repository) => void;
  /** Roving tabindex value (0 for the currently tabbable chip, -1 others). */
  tabIndex?: number;
  /** Roving tabindex index — exposed via `data-roving-index` for focus lookup. */
  rovingIndex?: number;
  /** Handler for arrow keys within the ring system. */
  onRovingKeyDown?: (
    event: KeyboardEvent<HTMLElement>,
    index: number,
  ) => void;
  /** Called when this chip becomes the focused/tabbable element. */
  onRovingFocus?: (index: number) => void;
}

// `filled` controls whether the star glyph is rendered as a solid GitHub-style
// star (starred/starring) or an outline (unstarred/checking/failed/unknown).
// The color token is applied via Tailwind text classes so `fill-current` picks
// it up on filled stars.
const STATUS_CONFIG: Record<
  StarStatus,
  { className: string; label: string; filled: boolean }
> = {
  starred: { className: "text-star-gold", label: "Starred", filled: true },
  unstarred: { className: "text-primary", label: "Not starred", filled: false },
  checking: {
    className: "text-muted-foreground animate-saturn-pulse",
    label: "Checking",
    filled: false,
  },
  starring: {
    className: "text-primary animate-saturn-pulse",
    label: "Starring",
    filled: true,
  },
  failed: { className: "text-destructive", label: "Failed", filled: false },
  unknown: { className: "text-muted-foreground", label: "Unknown", filled: false },
};

export const SaturnChip = memo(function SaturnChip({
  repo,
  status,
  onJump,
  onStarTrigger,
  tabIndex,
  rovingIndex,
  onRovingKeyDown,
  onRovingFocus,
}: SaturnChipProps) {
  const { className, label, filled } = STATUS_CONFIG[status];
  const [menuOpen, setMenuOpen] = useState(false);
  const key = repoKey(repo);
  const statusWord = status === "starred" ? "starred" : "not starred";

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // We intercept every primary click: the chip's job is to jump, not
    // navigate. Users still get right-click "Open in New Tab" via the href.
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
          className="saturn-chip"
          title={`${key} — ${statusWord}`}
          aria-label={`${key}, ${statusWord}`}
          data-roving-index={rovingIndex}
          tabIndex={tabIndex}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
        >
          <Star
            className={cn(
              "size-3 shrink-0",
              className,
              filled && "fill-current",
            )}
            role="img"
            aria-label={label}
          />
          <span className="truncate">
            {repo.owner}/{repo.name}
          </span>
        </a>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={6}
        className="w-48 p-1"
      >
        <div role="menu" aria-label={`${key} actions`} className="flex flex-col">
          <button
            type="button"
            role="menuitem"
            className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              setMenuOpen(false);
              onStarTrigger?.(repo);
            }}
          >
            Star
          </button>
          <a
            role="menuitem"
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
