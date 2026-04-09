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
import { HeroSection } from "@/components/hero-section";
import { HowItWorksSection } from "@/components/how-it-works-section";
import { ManualStarModal } from "@/components/manual-star-modal";
import { RepoMarquee } from "@/components/repo-marquee";
import { RepoSection } from "@/components/repo-section";
import { SlideTransition } from "@/components/slide-transition";
import { StarModal } from "@/components/star-modal";
import { StarringControls } from "@/components/starring-controls";
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

// Fallback combined star count when live data hasn't loaded yet.
const FALLBACK_COMBINED_STARS = 142000;

export default function HomePage() {
  const { user, token, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const { starStatuses, isStarring, progress, checkStars, starAll, retryStar, recheckRepo } =
    useStars();
  const { stats, reportStars } = useStats();
  const { requestToken, cancel: cancelOAuth } = useStarOAuth();
  const [starModalOpen, setStarModalOpen] = useState(false);
  const [starModalKey, setStarModalKey] = useState(0);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [starResult, setStarResult] = useState<{ starred: number; failed: number } | null>(null);
  const { repoMeta, combinedStars, isLoading: metaLoading } = useRepoMeta(REPOSITORIES, token);
  const formattedStars = useMemo(
    () => formatHeroStars(combinedStars ?? FALLBACK_COMBINED_STARS),
    [combinedStars],
  );
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const reposRef = useRef<HTMLDivElement | null>(null);
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

  const handleStarAll = useCallback(() => {
    setStarResult(null);
    setStarModalKey((k) => k + 1);
    setStarModalOpen(true);
  }, []);

  // Called by StarModal after the user completes classic OAuth authorization.
  // Returns the result so the modal can transition to the complete step.
  const handleStartStarring = useCallback(async (ephemeralToken: string) => {
    const result = await starAll({
      token: ephemeralToken,
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
    return result;
  }, [starAll, reportStars, token, handleSessionExpired, handleNetworkError, handleForbidden]);

  const unstarredRepos = useMemo(
    () => REPOSITORIES.filter((r) => starStatuses[repoKey(r)] === "unstarred"),
    [starStatuses],
  );

  const allDone =
    progress.total > 0 && progress.starred === progress.total;

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

      {/* Slide 1 — Hero */}
      <HeroSection
        repoCount={REPOSITORIES.length}
        formattedStars={formattedStars}
        categoryCount={CATEGORIES.length}
        communityStars={stats?.totalStars ?? null}
        onLogin={login}
        onViewRepositories={scrollToRepos}
        isAuthenticated={isAuthenticated}
        isLoading={authLoading}
      >
        {/* Starring controls — bottom of hero viewport */}
        {isAuthenticated && (
          <StarringControls
            progress={progress}
            isStarring={isStarring}
            allDone={allDone}
            onStarAll={handleStarAll}
            testId="starring-controls-hero"
          />
        )}
      </HeroSection>

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

      {/* Starring controls — after Saturn ring (top instance) */}
      {isAuthenticated && (
        <StarringControls
          progress={progress}
          isStarring={isStarring}
          allDone={allDone}
          onStarAll={handleStarAll}
          testId="starring-controls-top"
        />
      )}

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
        className="flex min-h-dvh flex-col justify-center gap-12 py-12 focus:outline-none"
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

      {/* Starring controls — after repos (bottom instance) */}
      {isAuthenticated && (
        <StarringControls
          progress={progress}
          isStarring={isStarring}
          allDone={allDone}
          onStarAll={handleStarAll}
          testId="starring-controls-bottom"
        />
      )}

      <SupportSection />

      {/* Star OAuth modal — 4-step flow (warning → auth → progress → complete) */}
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
