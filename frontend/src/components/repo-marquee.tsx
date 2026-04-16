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

import { memo, useEffect, useMemo, useRef } from "react";
import { RepoCard } from "@/components/repo-card";
import type { RepoMeta } from "@/lib/github";
import type { Repository, StarStatus } from "@/lib/types";
import { repoKey } from "@/lib/repo-key";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import {
  animateScrollToCenter,
  computeCenterScrollLeft,
  type AnimateScrollController,
} from "@/lib/animate-scroll";
import { EASE_OUT_EXPO_JS } from "@/components/roaming-star/constants";

/** Duration of the chip-jump highlight outline in ms. Exported so the
 *  parent page can size its highlightKey-clear timeout off a single source
 *  of truth (must be strictly greater than this value so a repeat jump to
 *  the same repo still re-triggers the effect). */
export const HIGHLIGHT_DURATION_MS = 600;

/** Duration of the rAF scroll tween that centers the target card. */
const SCROLL_ANIMATION_MS = 450;
/** Auto-scroll stays paused for this window after the tween resolves so the
 *  user can read the highlighted card before the marquee drifts away. */
const SCROLL_PAUSE_GRACE_MS = 800;

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
  /** Repo key ("owner/name") to jump to and highlight on change. */
  highlightKey?: string | null;
  /** Monotonic token changed by the caller on every jump so repeated jumps
   *  to the same key still trigger scroll + highlight. */
  highlightToken?: number;
}

// Minimum content width (px) for a seamless marquee loop — sized per breakpoint
// to avoid over-inflating mobile DOM.
const MIN_LOOP_DESKTOP_PX = 2560;
const MIN_LOOP_MOBILE_PX = 1024;
// Width of one card slot — desktop: 320px card + 32px gap; mobile: 240px + 16px.
const CARD_SLOT_DESKTOP_PX = 352;
const CARD_SLOT_MOBILE_PX = 256;
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
    prev.prefersReducedMotion !== next.prefersReducedMotion ||
    prev.highlightKey !== next.highlightKey ||
    prev.highlightToken !== next.highlightToken
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
  highlightKey = null,
  highlightToken = 0,
}: RepoMarqueeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const externalPausedRef = useRef(false);
  const scrollCancelRef = useRef<AnimateScrollController | null>(null);
  const graceTimeoutRef = useRef(0);

  // On every highlight token change where this marquee owns the key, scroll
  // the matching card to the visual centre with an eased rAF tween and add
  // the transient highlight class. The class is removed after
  // HIGHLIGHT_DURATION_MS so repeated jumps can re-trigger the animation
  // reliably.
  useEffect(() => {
    if (!highlightKey) return;
    const container = scrollRef.current;
    if (!container) return;
    const ownsKey = repos.some((r) => repoKey(r) === highlightKey);
    if (!ownsKey) return;
    // Query within this marquee only — duplicates share the data-repo-key so
    // we target the first (primary) instance to keep the highlight stable.
    const target = container.querySelector<HTMLElement>(
      `[data-repo-key="${highlightKey}"]`,
    );
    if (!target) return;

    // Cancel any prior in-flight tween + clear any pending grace timeout so
    // a rapid second click doesn't race the first.
    if (scrollCancelRef.current) {
      scrollCancelRef.current.cancelled = true;
    }
    if (graceTimeoutRef.current) {
      window.clearTimeout(graceTimeoutRef.current);
      graceTimeoutRef.current = 0;
    }

    if (prefersReducedMotion) {
      // Reduced-motion path: jump instantly. Auto-scroll is already disabled
      // upstream (RepoMarqueeProps.prefersReducedMotion gates useAutoScroll),
      // so no need to flip externalPausedRef.
      container.scrollLeft = computeCenterScrollLeft(container, target);
    } else {
      externalPausedRef.current = true;
      const controller: AnimateScrollController = { cancelled: false };
      scrollCancelRef.current = controller;
      animateScrollToCenter(
        container,
        target,
        SCROLL_ANIMATION_MS,
        EASE_OUT_EXPO_JS,
        controller,
      ).then(() => {
        // Only the most-recent controller resumes auto-scroll. A superseded
        // tween's cleanup is the next click's responsibility.
        if (scrollCancelRef.current !== controller) return;
        graceTimeoutRef.current = window.setTimeout(() => {
          externalPausedRef.current = false;
          graceTimeoutRef.current = 0;
        }, SCROLL_PAUSE_GRACE_MS);
      });
    }

    target.classList.add("repo-card-highlight");
    const t = window.setTimeout(() => {
      target.classList.remove("repo-card-highlight");
    }, HIGHLIGHT_DURATION_MS);
    return () => {
      window.clearTimeout(t);
      target.classList.remove("repo-card-highlight");
    };
  }, [highlightKey, highlightToken, repos, prefersReducedMotion]);

  // Final cleanup on unmount: cancel any in-flight tween and drop the grace
  // timeout so a stale rAF / setTimeout can't fire after we're gone.
  useEffect(() => {
    return () => {
      if (scrollCancelRef.current) {
        scrollCancelRef.current.cancelled = true;
        scrollCancelRef.current = null;
      }
      if (graceTimeoutRef.current) {
        window.clearTimeout(graceTimeoutRef.current);
        graceTimeoutRef.current = 0;
      }
    };
  }, []);

  // Duplication factor sized to the active card slot so small categories
  // still produce enough content for a seamless loop on both breakpoints.
  const cardSlotPx = isDesktop ? CARD_SLOT_DESKTOP_PX : CARD_SLOT_MOBILE_PX;
  const minLoopPx = isDesktop ? MIN_LOOP_DESKTOP_PX : MIN_LOOP_MOBILE_PX;
  const dupFactor = Math.max(1, Math.ceil(minLoopPx / (repos.length * cardSlotPx)));

  const expandedRepos = useMemo<Repository[]>(
    () =>
      dupFactor > 1
        ? Array.from({ length: dupFactor }, () => repos).flat()
        : repos,
    [repos, dupFactor],
  );

  // Auto-scroll whenever motion is allowed — both mobile and desktop.
  // externalPausedRef lets the highlight effect suppress the loop while a
  // chip-jump tween is running + during the grace window after.
  useAutoScroll(scrollRef, SCROLL_SPEED, !prefersReducedMotion, externalPausedRef);

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

  // Duplicate content is needed on both breakpoints for the seamless loop
  // (JS scroll resets scrollLeft to 0 when past the midpoint).
  const showDuplicate = !prefersReducedMotion;

  return (
    <div
      ref={scrollRef}
      className="relative overflow-x-auto px-4 scrollbar-none md:px-0"
      role="region"
      aria-label={label}
    >
      <div className="flex w-max gap-4 md:gap-8">
        <div className="flex gap-4 md:gap-8">
          {cards}
        </div>
        {showDuplicate && (
          <div aria-hidden="true" inert={true} className="flex gap-4 md:gap-8">
            {cards}
          </div>
        )}
      </div>
    </div>
  );
}, arePropsEqual);
