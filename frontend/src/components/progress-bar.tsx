import { Check } from "lucide-react";
import type { StarProgress } from "@/lib/types";

interface ProgressBarProps {
  progress: StarProgress;
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const { total, starred, remaining, current } = progress;
  const pct = total > 0 ? (starred / total) * 100 : 0;
  const allDone = total > 0 && starred === total;

  return (
    <div className="glass flex flex-col gap-2 rounded-xl p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {starred}/{total} repos starred
        </span>
        {allDone ? (
          <span className="flex items-center gap-1 text-success">
            <Check size={16} aria-hidden="true" />
            All done!
          </span>
        ) : (
          <span className="text-muted-foreground">{remaining} remaining</span>
        )}
      </div>

      <div
        className="relative h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={starred}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Starring progress"
      >
        <div
          className="h-full rounded-full bg-primary shadow-[0_0_12px_var(--primary)] transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p aria-live="polite" className="min-h-[1rem] truncate text-xs text-muted-foreground">
        {current && !allDone ? `Starring ${current}…` : ""}
      </p>
    </div>
  );
}
