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

import { memo } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Repository, StarStatus } from "@/lib/types";

interface SaturnChipProps {
  repo: Repository;
  status: StarStatus;
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
}: SaturnChipProps) {
  const { className, label, filled } = STATUS_CONFIG[status];

  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="saturn-chip"
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
  );
});
