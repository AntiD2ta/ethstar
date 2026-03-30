import { ProgressBar } from "@/components/progress-bar";
import { ShareButton } from "@/components/share-button";
import { StarAllButton } from "@/components/star-all-button";
import type { StarProgress } from "@/lib/types";

interface StarringControlsProps {
  progress: StarProgress;
  isStarring: boolean;
  allDone: boolean;
  onStarAll: () => void;
  testId?: string;
}

export function StarringControls({
  progress,
  isStarring,
  allDone,
  onStarAll,
  testId,
}: StarringControlsProps) {
  return (
    <div
      className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 pb-12"
      aria-label="Starring controls"
      data-testid={testId}
    >
      <ProgressBar progress={progress} />
      <div className="flex items-center justify-center gap-3">
        <StarAllButton
          remaining={progress.remaining}
          isStarring={isStarring}
          allDone={allDone}
          onClick={onStarAll}
        />
        {allDone && <ShareButton starredCount={progress.starred} />}
      </div>
    </div>
  );
}
