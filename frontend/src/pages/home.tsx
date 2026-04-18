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

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AuthHeader } from "@/components/auth-header";
import { CommunityStarsBanner } from "@/components/community-stars-banner";
import { HeroSection } from "@/components/hero-section";
import { HIGHLIGHT_DURATION_MS, RepoMarquee } from "@/components/repo-marquee";
import { RepoSection } from "@/components/repo-section";
import { READY_FILL_LEVEL } from "@/components/roaming-star/constants";
import { RoamingStar } from "@/components/roaming-star/roaming-star";
import type { RoamingStarState } from "@/components/roaming-star/types";
import { RingFilterSheet } from "@/components/saturn-carousel/ring-filter-sheet";
import { SlideTransition } from "@/components/slide-transition";
import { SupportSection } from "@/components/support-section";
import { TrustStripSection } from "@/components/trust-strip-section";
import { useAuth } from "@/hooks/auth-context";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRepoMeta } from "@/hooks/use-repo-meta";
import { useRingFilter } from "@/hooks/use-ring-filter";
import { useStarOAuth } from "@/hooks/use-star-oauth";
import { useStars } from "@/hooks/use-stars";
import { useStats } from "@/hooks/use-stats";
import { CATEGORIES, REPOSITORIES, REPOS_BY_CATEGORY } from "@/lib/repos";
import { repoKey } from "@/lib/repo-key";
import { deriveHeroStarsDisplay } from "@/lib/utils";
import type { Repository } from "@/lib/types";
import { onIdle } from "@/lib/webgl";

const SaturnCarousel = lazy(
  () => import("@/components/saturn-carousel/saturn-carousel"),
);

// Both modals only mount on user interaction. Splitting them out of the
// main bundle saves ~50-70 KB gzipped of parse/compile work on first paint.
// The lazy() wrapper does the chunk split; the `modalsReady` gate below
// keeps the import() from firing until the browser is idle (so the chunks
// don't compete with above-the-fold work). Named exports need the default
// shim because React.lazy only accepts default-exported modules.
const StarModal = lazy(() =>
  import("@/components/star-modal").then((m) => ({ default: m.StarModal })),
);
const ManualStarModal = lazy(() =>
  import("@/components/manual-star-modal").then((m) => ({ default: m.ManualStarModal })),
);

// Fallback combined star count shown briefly before live GitHub data loads.
// MUST be a conservative floor (≤ true live sum) so users never see a downward flicker.
// Refresh: sum `stargazerCount` across all repos in `@/lib/repos.ts` via GitHub GraphQL,
// then round down ~2% for headroom against occasional unstars.
// Last refreshed 2026-04-13: live sum ≈ 127,532 → floor 125,000.
const FALLBACK_COMBINED_STARS = 125000;

export default function HomePage() {
  const { user, token, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const { starStatuses, isChecking, isStarring, progress, checkStars, starAll, retryStar, recheckRepo } =
    useStars();
  const { stats, reportStars } = useStats();
  const { requestToken, cancel: cancelOAuth, status: oauthStatus } = useStarOAuth();
  const [starModalOpen, setStarModalOpen] = useState(false);
  const [starModalKey, setStarModalKey] = useState(0);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  // Gate that defers the modal lazy-chunk imports until idle. Flipped true
  // on the first idle tick after mount (or immediately when the user beats
  // the idle by opening a modal). The race is acceptable: the worst case
  // on a slow device is a brief Suspense blank before the first modal paints.
  const [modalsReady, setModalsReady] = useState(false);
  const [starResult, setStarResult] = useState<
    { starred: number; failed: number; aborted: boolean } | null
  >(null);
  const { repoMeta, combinedStars, isLoading: metaLoading } = useRepoMeta(REPOSITORIES, token);
  // `isLive` drives both the `~` prefix (honest placeholder marker) and the
  // opacity cross-fade. Derived from combinedStars instead of metaLoading
  // because metaLoading flips true → false even when the fetch fails and we
  // stay on the fallback forever. The pure `deriveHeroStarsDisplay` helper
  // pairs the label + isLive flag so they can never drift (a label with "~"
  // and isLive=true would misrepresent the data).
  const { label, isLive } = useMemo(
    () => deriveHeroStarsDisplay(combinedStars, FALLBACK_COMBINED_STARS),
    [combinedStars],
  );
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const reposRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const checkedTokenRef = useRef<string | null>(null);

  // Saturn-ring filter — default "core Ethereum spine" for signed-out users;
  // authed users can widen the selection via the filter sheet. Passing
  // `isAuthenticated` lets the hook expose an `effectiveFilter` that ignores
  // any stored customisation while signed out (localStorage is preserved, so
  // signing back in restores the user's choice).
  const ringFilter = useRingFilter(isAuthenticated);
  // Destructure `countProgress` so the memo dep is a plain local variable.
  // React Compiler's `preserve-manual-memoization` rule rejects a property
  // access (`ringFilter.countProgress`) as a dep when it would infer the
  // parent object — destructuring sidesteps that while preserving stability
  // (the hook memoizes `countProgress` against `selectedRepos`, so it only
  // changes when the filter does).
  const { countProgress } = ringFilter;
  const ringProgress = useMemo(
    () => countProgress(starStatuses),
    [countProgress, starStatuses],
  );

  // Ring → marquee jump state. `highlightKey` pins the current target repo
  // and `highlightToken` bumps monotonically so repeated jumps to the same
  // card still re-trigger the 600ms highlight.
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [highlightToken, setHighlightToken] = useState(0);
  const highlightResetRef = useRef<number | null>(null);

  const handleSessionExpired = useCallback(() => {
    toast.error("Session expired. Sign in again.");
  }, []);

  const handleNetworkError = useCallback(() => {
    toast.error("Couldn't reach GitHub. Check your connection.");
  }, []);

  // Two 403 paths with different root causes, so two toasts with different
  // fixes. The read path (checkStars, repo-meta lookups) uses the GitHub App
  // session token — a 403 there means the install lacks the required
  // permission. The write path (starAll, retryStar) uses the ephemeral
  // classic-OAuth token with `public_repo` — a 403 there is almost always
  // either an org-level OAuth app restriction or a mid-flow revocation.
  // A single toast advising "GitHub App → Starring: Read & Write" pointed
  // write-path failures at the wrong setting (GitHub App can't star at all
  // in this architecture; see CLAUDE.md on the hybrid OAuth approach).
  const handleReadForbidden = useCallback(() => {
    toast.error(
      "GitHub couldn't read your starred list. The Ethstar GitHub App may be missing permissions — revoke it in GitHub → Settings → Applications and sign in again.",
      { duration: 10_000 },
    );
  }, []);

  const handleStarForbidden = useCallback(() => {
    toast.error(
      "GitHub blocked starring. If you belong to a GitHub organisation, it may require third-party OAuth app approval. Check GitHub → Settings → Applications → Authorized OAuth Apps, or ask an org admin to approve Ethstar.",
      { duration: 10_000 },
    );
  }, []);

  // Kick off star status check when the user authenticates or the token rotates.
  useEffect(() => {
    if (token && token !== checkedTokenRef.current) {
      checkedTokenRef.current = token;
      void checkStars({
        onSessionExpired: handleSessionExpired,
        onNetworkError: handleNetworkError,
        onForbidden: handleReadForbidden,
      });
    } else if (!token) {
      checkedTokenRef.current = null;
    }
  }, [token, checkStars, handleSessionExpired, handleNetworkError, handleReadForbidden]);

  const scrollToRepos = useCallback(() => {
    reposRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleRetryStar = useCallback(
    (repo: Repository) => {
      // retryStar is a write path (starRepo) — a 403 here is almost always an
      // org-level OAuth restriction on the ephemeral star token, not a GitHub
      // App permission issue. Route to the write-path toast accordingly.
      void retryStar(repo, {
        onSessionExpired: handleSessionExpired,
        onNetworkError: handleNetworkError,
        onForbidden: handleStarForbidden,
      });
    },
    [retryStar, handleSessionExpired, handleNetworkError, handleStarForbidden],
  );

  const handleOpenManualModal = useCallback(() => {
    setManualModalOpen(true);
  }, []);

  // AbortController owned by home so the RoamingStar's Cancel button (and
  // Esc) can actually abort the starring loop. Reset per-run in handleStarAll
  // so a cancelled-then-reopened session doesn't inherit the old aborted flag.
  const starAbortRef = useRef<AbortController | null>(null);

  // Per-run repo selection. `null` = bulk mode (every currently-unstarred
  // repo); a single-element array = chip-menu Star on one repo. The bulk
  // RoamingStar passes `null`; chip menu passes the single Repository.
  const [pendingStarRepos, setPendingStarRepos] =
    useState<Repository[] | null>(null);

  const handleStarAll = useCallback((repos: Repository[] | null = null) => {
    setStarResult(null);
    setStarModalKey((k) => k + 1);
    setPendingStarRepos(repos);
    starAbortRef.current?.abort();
    starAbortRef.current = new AbortController();
    setStarModalOpen(true);
  }, []);

  // Called by StarModal after the user completes classic OAuth authorization.
  // Returns the result so the modal can transition to the complete step.
  // On a zero-failure finish, we close the modal here so the RoamingStar's
  // supernova plays over the backdrop fade-out (keeping setState out of
  // effects per the react-hooks/set-state-in-effect rule).
  const handleStartStarring = useCallback(async (ephemeralToken: string) => {
    const controller = starAbortRef.current ?? new AbortController();
    starAbortRef.current = controller;
    const result = await starAll({
      token: ephemeralToken,
      signal: controller.signal,
      repos: pendingStarRepos ?? undefined,
      onRateLimit: (waitMs) => {
        const seconds = Math.ceil(waitMs / 1000);
        toast.warning(
          `GitHub rate limit hit — pausing ${seconds}s before retrying…`,
        );
      },
      onSessionExpired: handleSessionExpired,
      onNetworkError: handleNetworkError,
      onForbidden: handleStarForbidden,
    });
    setStarResult(result);
    if (result.starred > 0) {
      reportStars(result.starred, token);
    }
    if (result.aborted) {
      // Don't close the modal — the modal's "stopped" terminal state owns the
      // "Stopped at X of Y" summary. A toast would duplicate the message and
      // announce a dismissal the user didn't yet acknowledge.
    } else if (result.failed === 0 && result.starred > 0) {
      toast.success(`All ${result.starred} repos starred`, {
        description:
          "Your GitHub token was discarded. Thanks for supporting Ethereum OSS.",
      });
      setStarModalOpen(false);
    }
    return result;
  }, [starAll, reportStars, token, pendingStarRepos, handleSessionExpired, handleNetworkError, handleStarForbidden]);

  const unstarredRepos = useMemo(
    () => REPOSITORIES.filter((r) => starStatuses[repoKey(r)] === "unstarred"),
    [starStatuses],
  );

  // What the modal will star this run. In bulk mode this is "every currently
  // unstarred repo"; in single-repo mode it's the one repo passed via the
  // chip menu. Drives the modal's count + target-label copy.
  const starModalTarget = useMemo(() => {
    if (pendingStarRepos && pendingStarRepos.length > 0) {
      const single = pendingStarRepos.length === 1 ? pendingStarRepos[0] : null;
      return {
        count: pendingStarRepos.length,
        repoLabel: single ? `${single.owner}/${single.name}` : null,
      };
    }
    return { count: unstarredRepos.length, repoLabel: null };
  }, [pendingStarRepos, unstarredRepos.length]);

  const allDone =
    progress.total > 0 && progress.starred === progress.total;

  // Memoize the counter string separately so it only re-allocates when the
  // actual starred/total tick forward — not on every sibling state change.
  const counterLabel = useMemo(
    () => `Starring ${progress.starred} / ${progress.total}`,
    [progress.starred, progress.total],
  );

  // Derive the RoamingStar's visual state from auth + progress snapshots.
  // The star is a controlled component — no internal ownership of these fields.
  const roamingState = useMemo<RoamingStarState>(() => {
    if (!isAuthenticated) {
      return {
        status: "disconnected",
        fillLevel: 0,
        remaining: REPOSITORIES.length,
        oauthStatus,
      };
    }
    if (allDone) {
      return {
        status: "success",
        fillLevel: 1,
        remaining: 0,
      };
    }
    if (isStarring) {
      const pct = progress.total > 0 ? progress.starred / progress.total : 0;
      return {
        status: "in-progress",
        fillLevel: pct,
        counterLabel,
        remaining: progress.remaining,
      };
    }
    if (starResult && starResult.failed > 0) {
      return {
        status: "partial-failure",
        fillLevel: READY_FILL_LEVEL,
        failedCount: starResult.failed,
        remaining: progress.remaining,
      };
    }
    return {
      status: "ready",
      fillLevel: READY_FILL_LEVEL,
      remaining: progress.remaining,
      // Surface the in-flight check so the secondary label renders a
      // skeleton rather than a live-flickering count. Flips to false once
      // every repo's status has resolved to starred/unstarred/failed.
      checking: isChecking,
    };
  }, [
    isAuthenticated,
    allDone,
    isStarring,
    isChecking,
    progress.total,
    progress.starred,
    progress.remaining,
    starResult,
    counterLabel,
    oauthStatus,
  ]);

  // Completion signal — drives supernova + closes modal. Guarded so the
  // happy-path auto-closes but the partial-failure case keeps the modal
  // open so the user can see failures and retry from there. A cancelled
  // run also skips the supernova (it's a celebratory finale, not a "you
  // stopped" moment). `starred > 0` prevents a zero-work run (e.g. user
  // somehow triggered starAll with nothing to do) from firing supernova
  // over an empty list — the animation is only earned by actual work.
  const completed =
    !isStarring &&
    starResult !== null &&
    starResult.failed === 0 &&
    starResult.starred > 0 &&
    !starResult.aborted;


  // Star click dispatch: unauth → start OAuth via login; auth → open modal
  // (which handles the star-OAuth popup flow). No-op when all repos are
  // already starred — the RoamingStar also gates this on `state.status ===
  // "success"`, but we guard here too so keyboard/programmatic callers
  // can't sneak past the visual state and open a 0-repo modal.
  // When `repo` is provided (chip-menu Star), we open the modal in
  // single-repo mode so just that one repo is starred. The bulk-mode
  // `allDone`/`isChecking` gates don't apply per-repo — clicking Star on
  // an individual chip should still work even after the bulk run finished
  // or while the initial check is in flight.
  const handleStarTrigger = useCallback(
    (repo?: Repository) => {
      if (!isAuthenticated) {
        login();
        return;
      }
      if (repo) {
        handleStarAll([repo]);
        return;
      }
      if (allDone) return;
      if (isChecking) return;
      handleStarAll();
    },
    [allDone, isChecking, isAuthenticated, login, handleStarAll],
  );

  const handleCancelStarring = useCallback(() => {
    starAbortRef.current?.abort();
  }, []);

  // Ring chip → marquee jump. Setting highlightKey + bumping highlightToken
  // triggers the matching marquee's useEffect, which scrolls the card into
  // view and adds the outline class. The reset delay is sized just past the
  // visual highlight so a subsequent jump to the same repo still re-triggers
  // the effect (same-key re-trigger needs the parent to hold the key beyond
  // the class removal).
  const HIGHLIGHT_RESET_PADDING_MS = 300;
  const handleRingJump = useCallback((repo: Repository) => {
    setHighlightKey(repoKey(repo));
    setHighlightToken((t) => t + 1);
    if (highlightResetRef.current != null) {
      window.clearTimeout(highlightResetRef.current);
    }
    highlightResetRef.current = window.setTimeout(
      () => {
        setHighlightKey(null);
        highlightResetRef.current = null;
      },
      HIGHLIGHT_DURATION_MS + HIGHLIGHT_RESET_PADDING_MS,
    );
  }, []);

  useEffect(() => {
    return () => {
      if (highlightResetRef.current != null) {
        window.clearTimeout(highlightResetRef.current);
      }
    };
  }, []);

  // Prefetch the modal chunks once the browser is idle so first-click is
  // instant, without competing with above-the-fold work. If the user opens
  // a modal before idle fires, the `modalsReady || *Open` gate below still
  // mounts the lazy boundary — at the cost of a brief Suspense blank.
  useEffect(() => {
    return onIdle(() => setModalsReady(true));
  }, []);

  // Memoize the floating filter-control fragment so it stays referentially
  // stable across `starStatuses` ticks. A fresh inline fragment on every
  // HomePage render would otherwise force SaturnCarousel to rebuild its
  // subtree unnecessarily.
  const filterControlNode = useMemo(
    () => (
      <>
        <span aria-live="polite" data-testid="ring-progress">
          {ringProgress.starred}/{ringProgress.selected} starred
        </span>
        <RingFilterSheet
          filter={ringFilter.filter}
          selectedCount={ringFilter.N}
          totalCount={REPOSITORIES.length}
          isAuthenticated={isAuthenticated}
          onToggleSection={ringFilter.toggleSection}
          onToggleRepo={ringFilter.toggleRepo}
          onReset={ringFilter.reset}
        />
      </>
    ),
    [
      ringProgress,
      ringFilter.filter,
      ringFilter.N,
      isAuthenticated,
      ringFilter.toggleSection,
      ringFilter.toggleRepo,
      ringFilter.reset,
    ],
  );

  return (
    <main className="flex flex-col overflow-x-hidden">
      {/* Skip link — visually hidden until focused so keyboard users can
          bypass the hero and controls and land directly on the repo list. */}
      <a href="#repos" className="skip-link">
        Skip to repositories
      </a>
      <AuthHeader
        user={user}
        isAuthenticated={isAuthenticated}
        isLoading={authLoading}
        onLogin={login}
        onLogout={logout}
      />

      <CommunityStarsBanner totalStars={stats?.totalStars ?? null} />

      {/* Slide 1 — Hero. The RoamingStar dormant slot lives inside as the
          primary CTA; it detaches to a free-floating layer once the hero
          scrolls out of view. */}
      <HeroSection
        ref={heroRef}
        repoCount={REPOSITORIES.length}
        formattedStars={label}
        starsAreLive={isLive}
        categoryCount={CATEGORIES.length}
        onViewRepositories={scrollToRepos}
        // The star supernovas and self-dismisses once the user has starred
        // every repo in their connected session. Use `allDone` as the "no
        // primary CTA" signal so the secondary button drops its connector.
        primaryCtaPresent={!allDone}
        primaryCta={
          <RoamingStar
            heroRef={heroRef}
            state={roamingState}
            inProgress={isStarring}
            completed={completed}
            onTrigger={handleStarTrigger}
            onCancel={handleCancelStarring}
          />
        }
      />

      <SlideTransition />

      {/* Slide 2 — Saturn Ring. Now a filter view + jump navigator: the
          chips render the user's filtered selection (default: core Ethereum
          spine), clicking a chip scrolls to the matching marquee card, and
          chip fill state mirrors live starStatuses.
          The `filterControl` slot floats the ring-progress + Customize pill
          into the bottom-right of the ring section so it stays visible even
          when bottom-arc chips from outer rings sweep below the center. */}
      <Suspense fallback={null}>
        <SaturnCarousel
          starStatuses={starStatuses}
          repoMeta={repoMeta}
          metaLoading={metaLoading}
          isDesktop={isDesktop}
          prefersReducedMotion={prefersReducedMotion}
          repos={ringFilter.effectiveRepos}
          onJump={handleRingJump}
          onStarTrigger={handleStarTrigger}
          filterControl={filterControlNode}
        />
      </Suspense>

      <SlideTransition />

      {/* Slide 3 — Trust strip. Replaces the prior Authenticate/Star/Support
          card grid, which retold the hero-to-modal story in identikit boxes
          and read as AI template filler. Condensed to three disclosures —
          scope, token lifetime, coverage — that earn their space instead of
          echoing what the user already saw. */}
      <TrustStripSection
        repoCount={REPOSITORIES.length}
        formattedStars={label}
        starsAreLive={isLive}
      />

      <SlideTransition />

      {/* Slide 4 — Repositories */}
      <div
        ref={reposRef}
        id="repos"
        tabIndex={-1}
        className="flex flex-col gap-12 py-12 focus:outline-none"
      >
        {/* Summary line — visible only once checkStars has resolved every
            repo. While checking, or before auth, we suppress the line to
            avoid a flash of stale/incorrect counts. */}
        {isAuthenticated && !isChecking && progress.total > 0 && (
          <p
            data-testid="repos-summary"
            className="px-4 text-center text-sm text-muted-foreground sm:px-6"
            role="status"
            aria-live="polite"
          >
            {unstarredRepos.length === 0 ? (
              <>All {progress.total} repos starred — thank you.</>
            ) : (
              <>
                <strong className="text-foreground">
                  {unstarredRepos.length} of {progress.total}
                </strong>{" "}
                unstarred
              </>
            )}
          </p>
        )}
        {CATEGORIES.map((category) => (
          <RepoSection
            key={category.name}
            name={category.name}
            iconName={category.icon}
          >
            <RepoMarquee
              repos={REPOS_BY_CATEGORY[category.name]}
              starStatuses={starStatuses}
              repoMeta={repoMeta}
              metaLoading={metaLoading}
              isAuthenticated={isAuthenticated}
              onRetry={handleRetryStar}
              isDesktop={isDesktop}
              prefersReducedMotion={prefersReducedMotion}
              label={`Scrolling list of ${category.name} repositories`}
              highlightKey={highlightKey}
              highlightToken={highlightToken}
            />
          </RepoSection>
        ))}
      </div>

      <SupportSection />

      {/* Modals — lazy-split out of the main bundle and gated on either the
          first idle tick post-mount or a user-triggered open. The Suspense
          fallback is null because the idle path has no UI and a user-open
          race shows a near-instant blank rather than a spinner. */}
      {(modalsReady || starModalOpen || manualModalOpen) && (
        <Suspense fallback={null}>
          {/* Star OAuth modal — 4-step flow (warning → auth → progress → complete).
              The progress step visually defers to the RoamingStar (takeover mode);
              the modal shell still provides Radix focus-trap + inert-page. */}
          <StarModal
            key={starModalKey}
            open={starModalOpen}
            onOpenChange={(open) => {
              setStarModalOpen(open);
              if (!open) setPendingStarRepos(null);
            }}
            targetCount={starModalTarget.count}
            targetRepoLabel={starModalTarget.repoLabel}
            progress={progress}
            onStartStarring={handleStartStarring}
            requestToken={requestToken}
            cancelOAuth={cancelOAuth}
            starResult={starResult}
            onOpenManualModal={handleOpenManualModal}
            onCancelStarring={handleCancelStarring}
            popupBlocked={oauthStatus === "blocked"}
          />

          {/* Manual starring modal — list of unstarred repos with GitHub links */}
          <ManualStarModal
            open={manualModalOpen}
            onOpenChange={setManualModalOpen}
            repos={REPOSITORIES}
            starStatuses={starStatuses}
            onRecheckRepo={recheckRepo}
          />
        </Suspense>
      )}
    </main>
  );
}
