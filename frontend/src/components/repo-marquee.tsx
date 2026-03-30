import { memo, useRef } from "react";
import { RepoCard } from "@/components/repo-card";
import type { RepoMeta } from "@/lib/github";
import type { Repository, StarStatus } from "@/lib/types";
import { repoKey } from "@/lib/repo-key";
import { useAutoScroll } from "@/hooks/use-auto-scroll";

interface RepoMarqueeProps {
  /** Stable module-level constant — reference never changes. */
  repos: Repository[];
  starStatuses: Record<string, StarStatus>;
  repoMeta: Record<string, RepoMeta>;
  metaLoading: boolean;
  isAuthenticated: boolean;
  onRetry?: (repo: Repository) => void;
  /** Whether the viewport is at least md (768px). */
  isDesktop: boolean;
  /** Whether reduced motion is preferred. */
  prefersReducedMotion?: boolean;
  label?: string;
}

// Minimum content width (px) for a seamless marquee loop.
// Set to 2560 to cover ultrawide monitors without visible gaps.
const MIN_LOOP_PX = 2560;
// Width of one card slot: 320px card + 32px gap.
const CARD_SLOT_PX = 352;
// Auto-scroll speed in pixels per second.
const SCROLL_SPEED = 50;

/** Custom comparator: only re-render when data for THIS marquee's repos changes. */
function arePropsEqual(prev: RepoMarqueeProps, next: RepoMarqueeProps): boolean {
  if (
    prev.repos !== next.repos ||
    prev.isDesktop !== next.isDesktop ||
    prev.label !== next.label ||
    prev.metaLoading !== next.metaLoading ||
    prev.isAuthenticated !== next.isAuthenticated ||
    prev.onRetry !== next.onRetry ||
    prev.prefersReducedMotion !== next.prefersReducedMotion
  ) {
    return false;
  }
  // Only compare the slice of starStatuses/repoMeta relevant to this marquee.
  for (const repo of prev.repos) {
    const k = repoKey(repo);
    if (prev.starStatuses[k] !== next.starStatuses[k]) return false;
    if (prev.repoMeta[k] !== next.repoMeta[k]) return false;
  }
  return true;
}

// Memoized with custom comparator: starStatuses changes in other categories
// no longer defeat this marquee's memo() bailout.
export const RepoMarquee = memo(function RepoMarquee({
  repos,
  starStatuses,
  repoMeta,
  metaLoading,
  isAuthenticated,
  onRetry,
  isDesktop,
  prefersReducedMotion = false,
  label = "Scrolling repository list",
}: RepoMarqueeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Duplication factor so categories produce enough cards for a seamless loop.
  const dupFactor = Math.max(1, Math.ceil(MIN_LOOP_PX / (repos.length * CARD_SLOT_PX)));

  const expandedRepos: Repository[] = dupFactor > 1
    ? Array.from({ length: dupFactor }, () => repos).flat()
    : repos;

  // Auto-scroll on desktop when motion is allowed
  useAutoScroll(scrollRef, SCROLL_SPEED, isDesktop && !prefersReducedMotion);

  const cards = expandedRepos.map((repo, i) => {
    const k = repoKey(repo);
    return (
      <RepoCard
        key={`${k}-${i}`}
        repo={repo}
        status={starStatuses[k] ?? "unknown"}
        starCount={repoMeta[k]?.stargazers_count}
        liveDescription={repoMeta[k]?.description}
        metaLoading={metaLoading}
        onRetry={isAuthenticated ? onRetry : undefined}
      />
    );
  });

  // Duplicate content is always needed for desktop seamless loop (JS scroll
  // resets scrollLeft to 0 when past the midpoint). On mobile, no duplication
  // since there's no auto-scroll — the user scrolls manually.
  const showDuplicate = isDesktop && !prefersReducedMotion;

  return (
    <div
      ref={scrollRef}
      className="relative overflow-x-auto px-4 scrollbar-none md:px-0"
      role="region"
      aria-label={label}
    >
      <div className="flex w-max">
        <div className="flex gap-6 md:gap-8">
          {cards}
        </div>
        {showDuplicate && (
          <div aria-hidden="true" className="flex gap-6 md:gap-8">
            {cards}
          </div>
        )}
      </div>
    </div>
  );
}, arePropsEqual);
