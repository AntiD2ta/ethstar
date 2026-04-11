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

import { Star } from "lucide-react";

interface CommunityStarsBannerProps {
  totalStars: number | null;
}

export function CommunityStarsBanner({ totalStars }: CommunityStarsBannerProps) {
  if (totalStars === null || totalStars <= 0) return null;

  return (
    <div
      className="glass flex items-center justify-center gap-2 px-4 py-2 text-center text-sm text-muted-foreground"
      role="status"
      aria-label={`${totalStars.toLocaleString()} stars given through Ethstar by the community`}
    >
      <Star
        size={14}
        className="shrink-0 text-star-gold"
        fill="currentColor"
        strokeWidth={0}
        aria-hidden="true"
      />
      <span>
        <span className="font-semibold text-foreground">
          {totalStars.toLocaleString()}
        </span>{" "}
        stars given through Ethstar by the community
      </span>
    </div>
  );
}
