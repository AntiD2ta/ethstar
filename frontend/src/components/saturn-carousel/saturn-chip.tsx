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
