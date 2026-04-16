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
// Number of identical content-group copies the marquee renders. Three copies
// power the seamless bidirectional loop: the middle copy is the "live" region
// useAutoScroll keeps the user centred in. Both the dupFactor math and the
// JSX read this constant so they stay in lockstep.
const MARQUEE_COPY_COUNT = 3;

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
  const graceTimeoutRef = useRef<number | null>(null);

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
    // Each repo renders once per content copy (three copies drive the
    // bidirectional infinite loop). Pick the instance closest to the current
    // scroll position so the tween moves the shortest distance and stays
    // inside the middle copy — wrapping won't teleport the user mid-tween.
    const candidates = container.querySelectorAll<HTMLElement>(
      `[data-repo-key="${highlightKey}"]`,
    );
    if (candidates.length === 0) return;
    const viewportCenter = container.scrollLeft + container.clientWidth / 2;
    let target = candidates[0];
    let bestDist = Infinity;
    for (const el of candidates) {
      const cardCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(cardCenter - viewportCenter);
      if (dist < bestDist) {
        bestDist = dist;
        target = el;
      }
    }

    // Cancel any prior in-flight tween + clear any pending grace timeout so
    // a rapid second click doesn't race the first.
    if (scrollCancelRef.current) {
      scrollCancelRef.current.cancelled = true;
    }
    if (graceTimeoutRef.current != null) {
      window.clearTimeout(graceTimeoutRef.current);
      graceTimeoutRef.current = null;
    }

    // The marquee often sits below the fold when the user clicks a ring chip
    // — scroll the marquee vertically into view so the horizontal tween and
    // highlight are actually visible. `inline: "nearest"` avoids fighting the
    // marquee's own horizontal tween.
    container.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });

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
          graceTimeoutRef.current = null;
        }, SCROLL_PAUSE_GRACE_MS);
      });
    }

    // Highlight every duplicate of the target — the user might be looking at
    // any of the three copies after a manual scroll, and whichever copy ends
    // up in the viewport should light up.
    for (const el of candidates) {
      el.classList.add("repo-card-highlight");
    }
    const t = window.setTimeout(() => {
      for (const el of candidates) {
        el.classList.remove("repo-card-highlight");
      }
    }, HIGHLIGHT_DURATION_MS);
    return () => {
      window.clearTimeout(t);
      for (const el of candidates) {
        el.classList.remove("repo-card-highlight");
      }
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
      if (graceTimeoutRef.current != null) {
        window.clearTimeout(graceTimeoutRef.current);
        graceTimeoutRef.current = null;
      }
    };
  }, []);

  // Duplication factor sized to the active card slot so small categories
  // still produce enough content for a seamless loop on both breakpoints.
  // Divide minLoopPx by MARQUEE_COPY_COUNT because the JSX already renders
  // that many copies of `cards` — the loop length the marquee actually sees
  // is repos.length * cardSlotPx * MARQUEE_COPY_COUNT * dupFactor.
  const cardSlotPx = isDesktop ? CARD_SLOT_DESKTOP_PX : CARD_SLOT_MOBILE_PX;
  const minLoopPx = isDesktop ? MIN_LOOP_DESKTOP_PX : MIN_LOOP_MOBILE_PX;
  const dupFactor = Math.max(
    1,
    Math.ceil(minLoopPx / (repos.length * cardSlotPx * MARQUEE_COPY_COUNT)),
  );

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

  // Three identical copies power the seamless loop: useAutoScroll keeps the
  // user centered in the middle copy so manual scroll can wrap in either
  // direction. Reduced motion skips the duplicates entirely (no looping, no
  // wasted DOM).
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
        {showDuplicate &&
          Array.from({ length: MARQUEE_COPY_COUNT - 1 }, (_, i) => (
            <div
              key={`dup-${i}`}
              aria-hidden="true"
              inert={true}
              className="flex gap-4 md:gap-8"
            >
              {cards}
            </div>
          ))}
      </div>
    </div>
  );
}, arePropsEqual);
