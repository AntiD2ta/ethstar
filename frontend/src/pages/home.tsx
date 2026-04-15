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
import { HowItWorksSection } from "@/components/how-it-works-section";
import { ManualStarModal } from "@/components/manual-star-modal";
import { RepoMarquee } from "@/components/repo-marquee";
import { RepoSection } from "@/components/repo-section";
import { READY_FILL_LEVEL } from "@/components/roaming-star/constants";
import { RoamingStar } from "@/components/roaming-star/roaming-star";
import type { RoamingStarState } from "@/components/roaming-star/types";
import { SlideTransition } from "@/components/slide-transition";
import { StarModal } from "@/components/star-modal";
import { SupportSection } from "@/components/support-section";
import { useAuth } from "@/hooks/auth-context";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRepoMeta } from "@/hooks/use-repo-meta";
import { useStarOAuth } from "@/hooks/use-star-oauth";
import { useStars } from "@/hooks/use-stars";
import { useStats } from "@/hooks/use-stats";
import { CATEGORIES, REPOSITORIES, REPOS_BY_CATEGORY } from "@/lib/repos";
import { repoKey } from "@/lib/repo-key";
import { formatHeroStars } from "@/lib/utils";
import type { Repository } from "@/lib/types";

const SaturnCarousel = lazy(
  () => import("@/components/saturn-carousel/saturn-carousel"),
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
  const [starResult, setStarResult] = useState<
    { starred: number; failed: number; aborted: boolean } | null
  >(null);
  const { repoMeta, combinedStars, isLoading: metaLoading } = useRepoMeta(REPOSITORIES, token);
  const formattedStars = useMemo(
    () => formatHeroStars(combinedStars ?? FALLBACK_COMBINED_STARS),
    [combinedStars],
  );
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const reposRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const checkedTokenRef = useRef<string | null>(null);

  const handleSessionExpired = useCallback(() => {
    toast.error("Session expired. Sign in again.");
  }, []);

  const handleNetworkError = useCallback(() => {
    toast.error("Couldn't reach GitHub. Check your connection.");
  }, []);

  const handleForbidden = useCallback(() => {
    toast.error(
      "GitHub denied permission to star repos. Check that your GitHub App has Starring set to \"Read & Write\" in its permissions, then sign in again.",
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
        onForbidden: handleForbidden,
      });
    } else if (!token) {
      checkedTokenRef.current = null;
    }
  }, [token, checkStars, handleSessionExpired, handleNetworkError, handleForbidden]);

  const scrollToRepos = useCallback(() => {
    reposRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleRetryStar = useCallback(
    (repo: Repository) => {
      void retryStar(repo, {
        onSessionExpired: handleSessionExpired,
        onNetworkError: handleNetworkError,
        onForbidden: handleForbidden,
      });
    },
    [retryStar, handleSessionExpired, handleNetworkError, handleForbidden],
  );

  // Open the star modal instead of directly starring — the modal handles
  // the classic OAuth popup flow and passes the ephemeral token to starAll.
  const handleOpenManualModal = useCallback(() => {
    setManualModalOpen(true);
  }, []);

  // AbortController owned by home so the RoamingStar's Cancel button (and
  // Esc) can actually abort the starring loop. Reset per-run in handleStarAll
  // so a cancelled-then-reopened session doesn't inherit the old aborted flag.
  const starAbortRef = useRef<AbortController | null>(null);

  const handleStarAll = useCallback(() => {
    setStarResult(null);
    setStarModalKey((k) => k + 1);
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
      onRateLimit: (waitMs) => {
        const seconds = Math.ceil(waitMs / 1000);
        toast.warning(
          `GitHub rate limit hit — pausing ${seconds}s before retrying…`,
        );
      },
      onSessionExpired: handleSessionExpired,
      onNetworkError: handleNetworkError,
      onForbidden: handleForbidden,
    });
    setStarResult(result);
    if (result.starred > 0) {
      reportStars(result.starred, token);
    }
    if (result.aborted) {
      toast.info(
        result.starred > 0
          ? `Starring stopped — ${result.starred} repos were starred before you cancelled.`
          : "Starring cancelled.",
      );
      setStarModalOpen(false);
    } else if (result.failed === 0 && result.starred > 0) {
      toast.success(`All ${result.starred} repos starred`, {
        description:
          "Your GitHub token was discarded. Thanks for supporting Ethereum OSS.",
      });
      setStarModalOpen(false);
    }
    return result;
  }, [starAll, reportStars, token, handleSessionExpired, handleNetworkError, handleForbidden]);

  const unstarredRepos = useMemo(
    () => REPOSITORIES.filter((r) => starStatuses[repoKey(r)] === "unstarred"),
    [starStatuses],
  );

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
  const handleStarTrigger = useCallback(() => {
    if (allDone) return;
    if (!isAuthenticated) {
      login();
      return;
    }
    handleStarAll();
  }, [allDone, isAuthenticated, login, handleStarAll]);

  const handleCancelStarring = useCallback(() => {
    starAbortRef.current?.abort();
  }, []);

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
        formattedStars={formattedStars}
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

      {/* Slide 2 — Saturn Ring */}
      <Suspense fallback={null}>
        <SaturnCarousel
          starStatuses={starStatuses}
          repoMeta={repoMeta}
          metaLoading={metaLoading}
          isDesktop={isDesktop}
          prefersReducedMotion={prefersReducedMotion}
        />
      </Suspense>

      <SlideTransition />

      {/* Slide 3 — How It Works */}
      <HowItWorksSection
        isAuthenticated={isAuthenticated}
        onLogin={login}
        onViewRepositories={scrollToRepos}
      />

      <SlideTransition />

      {/* Slide 4 — Repositories */}
      <div
        ref={reposRef}
        id="repos"
        tabIndex={-1}
        className="flex flex-col gap-12 py-12 focus:outline-none"
      >
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
            />
          </RepoSection>
        ))}
      </div>

      <SupportSection />

      {/* Star OAuth modal — 4-step flow (warning → auth → progress → complete).
          The progress step visually defers to the RoamingStar (takeover mode);
          the modal shell still provides Radix focus-trap + inert-page. */}
      <StarModal
        key={starModalKey}
        open={starModalOpen}
        onOpenChange={setStarModalOpen}
        unstarredCount={unstarredRepos.length}
        progress={progress}
        onStartStarring={handleStartStarring}
        requestToken={requestToken}
        cancelOAuth={cancelOAuth}
        starResult={starResult}
        onOpenManualModal={handleOpenManualModal}
        onCancelStarring={handleCancelStarring}
      />

      {/* Manual starring modal — list of unstarred repos with GitHub links */}
      <ManualStarModal
        open={manualModalOpen}
        onOpenChange={setManualModalOpen}
        repos={REPOSITORIES}
        starStatuses={starStatuses}
        onRecheckRepo={recheckRepo}
      />
    </main>
  );
}
