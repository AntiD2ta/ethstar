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
import { Check, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StarAllButtonProps {
  remaining: number;
  isStarring: boolean;
  allDone: boolean;
  onClick: () => void;
}

export const StarAllButton = memo(function StarAllButton({
  remaining,
  isStarring,
  allDone,
  onClick,
}: StarAllButtonProps) {
  const disabled = isStarring || allDone || remaining === 0;

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size="lg"
      className="rounded-full bg-primary px-8 text-primary-foreground hover:bg-primary/90"
    >
      {isStarring ? (
        <>
          <Loader2
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          Starring…
        </>
      ) : allDone ? (
        <>
          <Check aria-hidden="true" />
          All Starred!
        </>
      ) : (
        <>
          <Star
            fill="currentColor"
            strokeWidth={0}
            aria-hidden="true"
          />
          Star All {remaining} Remaining
        </>
      )}
    </Button>
  );
});
