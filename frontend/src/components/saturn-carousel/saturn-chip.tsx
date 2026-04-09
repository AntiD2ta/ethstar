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
import { cn } from "@/lib/utils";
import type { Repository, StarStatus } from "@/lib/types";

interface SaturnChipProps {
  repo: Repository;
  status: StarStatus;
}

const STATUS_CONFIG: Record<StarStatus, { className: string; label: string }> =
  {
    starred: { className: "bg-star-gold", label: "Starred" },
    unstarred: { className: "bg-primary", label: "Not starred" },
    checking: {
      className: "bg-muted-foreground animate-saturn-pulse",
      label: "Checking",
    },
    starring: {
      className: "bg-primary animate-saturn-pulse",
      label: "Starring",
    },
    failed: { className: "bg-destructive", label: "Failed" },
    unknown: { className: "bg-muted-foreground", label: "Unknown" },
  };

export const SaturnChip = memo(function SaturnChip({
  repo,
  status,
}: SaturnChipProps) {
  const { className, label } = STATUS_CONFIG[status];

  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="saturn-chip"
    >
      <span
        className={cn("size-2 shrink-0 rounded-full", className)}
        aria-label={label}
      />
      <span className="truncate">
        {repo.owner}/{repo.name}
      </span>
    </a>
  );
});
