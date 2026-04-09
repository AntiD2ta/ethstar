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
