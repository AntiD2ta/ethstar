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
import { Loader2, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatStarCount } from "@/lib/utils";
import type { Repository, StarStatus } from "@/lib/types";

interface SaturnCardProps {
  repo: Repository;
  status: StarStatus;
  starCount?: number;
  liveDescription?: string | null;
  metaLoading?: boolean;
}

export const SaturnCard = memo(function SaturnCard({
  repo,
  status,
  starCount,
  liveDescription,
  metaLoading,
}: SaturnCardProps) {
  const description = liveDescription ?? repo.description;

  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="saturn-card group"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate font-heading text-xs font-semibold leading-tight">
          <span className="text-muted-foreground">{repo.owner}/</span>
          <span className="text-primary group-hover:underline">
            {repo.name}
          </span>
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
