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

import { memo, useCallback } from "react";
import { Loader2, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatStarCount } from "@/lib/utils";
import type { Repository, StarStatus } from "@/lib/types";

interface RepoCardProps {
  repo: Repository;
  status: StarStatus;
  starCount?: number;
  liveDescription?: string | null;
  metaLoading?: boolean;
  onRetry?: (repo: Repository) => void;
}

export const RepoCard = memo(function RepoCard({
  repo,
  status,
  starCount,
  liveDescription,
  metaLoading,
  onRetry,
}: RepoCardProps) {
  const handleRetry = useCallback(() => {
    onRetry?.(repo);
  }, [onRetry, repo]);

  const description = liveDescription ?? repo.description;

  return (
    <article
      className={cn(
        "glass glass-hover group flex h-44 w-[320px] shrink-0 flex-col justify-between rounded-xl p-5 transition-all",
        "hover:eth-glow"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1"
        >
          <h3 className="truncate font-heading text-base font-semibold text-primary group-hover:underline">
            {repo.owner}/{repo.name}
          </h3>
        </a>
        {typeof starCount === "number" ? (
          <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Star
              size={12}
              fill="currentColor"
              strokeWidth={0}
              aria-hidden="true"
            />
            <span>{formatStarCount(starCount)}</span>
          </div>
        ) : metaLoading ? (
          <Skeleton className="h-4 w-10 shrink-0 rounded" />
        ) : null}
      </div>

      {metaLoading && !liveDescription ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-full rounded" />
          <Skeleton className="h-3.5 w-3/4 rounded" />
        </div>
      ) : (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {description}
        </p>
      )}

      <div className="flex items-center justify-between">
        <Avatar size="sm">
          <AvatarImage
            src={`https://github.com/${repo.owner}.png?size=40`}
            alt={repo.owner}
          />
          <AvatarFallback>
            {repo.owner.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <StarIndicator
          status={status}
          onRetry={onRetry ? handleRetry : undefined}
        />
      </div>
    </article>
  );
});

function StarIndicator({
  status,
  onRetry,
}: {
  status: StarStatus;
  onRetry?: () => void;
}) {
  if (status === "checking") {
    return <Skeleton className="h-5 w-5 rounded-full" aria-label="Checking" />;
  }
  if (status === "starring") {
    return (
      <Loader2
        className="animate-spin text-primary motion-reduce:animate-none"
        size={20}
        aria-label="Starring"
      />
    );
  }
  if (status === "starred") {
    return (
      <Star
        className="text-star-gold"
        fill="currentColor"
        strokeWidth={0}
        size={20}
        aria-label="Starred"
      />
    );
  }
  if (status === "failed") {
    if (onRetry) {
      return (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full text-destructive transition-colors hover:text-primary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label="Retry starring"
        >
          <Star size={20} aria-hidden="true" />
        </button>
      );
    }
    return (
      <Star
        className="text-destructive"
        size={20}
        aria-label="Failed to star"
      />
    );
  }
  // unstarred or unknown
  return (
    <Star
      className="text-muted-foreground"
      size={20}
      aria-label={status === "unstarred" ? "Not starred" : "Unknown"}
    />
  );
}
