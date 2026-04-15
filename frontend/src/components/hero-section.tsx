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

import type { Ref, ReactNode } from "react";
import { Star } from "lucide-react";
import { HeroLogo } from "./hero-logo";

interface HeroSectionProps {
  repoCount: number;
  formattedStars: string;
  categoryCount: number;
  onViewRepositories: () => void;
  /** The primary CTA slot — owned by the RoamingStar component, which lives
   *  here when dormant and detaches to a free-floating layer when the hero
   *  scrolls out of view. */
  primaryCta: ReactNode;
  /** True while the primary CTA is actually visible (star rendered, not
   *  dismissed, not finished). Drives the "or" prefix on the secondary CTA —
   *  without a star, "or browse the repositories" reads as a dangling
   *  connector. */
  primaryCtaPresent: boolean;
  /** Optional content rendered after the stats row (e.g. starring controls). */
  children?: ReactNode;
  /** Forwarded to the outer `<section>`. The RoamingStar observes this element
   *  to decide whether to remain in-slot or detach into roaming mode. */
  ref?: Ref<HTMLElement>;
}

export function HeroSection({
  repoCount,
  formattedStars,
  categoryCount,
  onViewRepositories,
  primaryCta,
  primaryCtaPresent,
  children,
  ref,
}: HeroSectionProps) {
  return (
    <section
      ref={ref}
      data-testid="hero-section"
      /* Short-laptop fallback: on viewports ≤800px tall the md:py-20 + gap-8
         stack pushes the "or browse" secondary CTA below the fold. Arbitrary
         max-height variants compress padding so the whole CTA cluster stays
         in one viewport without changing the tall-screen composition. */
      className="relative flex min-h-dvh flex-col items-center px-4 py-12 text-center md:px-6 md:py-20 [@media(min-width:768px)_and_(max-height:800px)]:py-10"
    >
      <HeroLogo />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 md:gap-8 [@media(min-width:768px)_and_(max-height:800px)]:gap-5">
        <h1 className="font-heading text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
          <span className="text-foreground">Star Every</span>{" "}
          <span className="text-eth-highlight">Ethereum</span>{" "}
          <span className="text-foreground">Repo</span>
        </h1>

        <p className="max-w-2xl text-base text-muted-foreground min-[375px]:text-lg">
          Support the teams and devs building a decentralized world. Authenticate
          with GitHub to{" "}
          <Star
            size={18}
            className="inline-block align-text-bottom text-star-gold"
            fill="currentColor"
            strokeWidth={0}
            aria-hidden="true"
          />{" "}
          {repoCount}+ fundamental repositories in a single action.
        </p>

        <div className="flex flex-col items-center gap-5">
          {/* Primary CTA — the RoamingStar (dormant form) renders here.
              It replaces the legacy "Connect via GitHub" button and the
              inline "Star All" row; the star is the single entry point. */}
          <div className="flex flex-col items-center">{primaryCta}</div>
          {/* Secondary CTA — editorial text link so the two actions share a
              visual register. The old shadcn outline pill read like a
              different design system next to the star + editorial labels. */}
          <button
            type="button"
            onClick={onViewRepositories}
            className="group inline-flex items-center gap-1.5 rounded font-heading text-sm font-semibold tracking-tight text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {primaryCtaPresent ? "or browse the repositories" : "Browse the repositories"}
            <span
              aria-hidden="true"
              className="text-base leading-none transition-transform group-hover:translate-y-0.5"
            >
              ↓
            </span>
          </button>
        </div>

        {/* Stats row is hidden on <md to keep the mobile hero inside one
            viewport. Phase E owns the hero reframe — until then, a single
            inline summary lives below for cognitive clarity on small screens. */}
        <p className="text-xs text-muted-foreground md:hidden" aria-label="Site statistics">
          <span className="font-semibold text-primary">{repoCount}+</span> repos ·{" "}
          <span className="font-semibold text-primary">{formattedStars}</span> combined stars
        </p>

        <div className="hidden items-center gap-3 text-center md:flex md:gap-10" aria-label="Site statistics" role="group">
          <div aria-label={`${repoCount}+ repositories`}>
            <span className="text-2xl font-bold text-primary">{repoCount}+</span>
            <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
              Repos
            </span>
          </div>
          <span className="text-border" aria-hidden="true">·</span>
          <div aria-label={`${formattedStars} combined stars`}>
            <span className="text-2xl font-bold text-primary">{formattedStars}</span>
            <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
              Combined Stars
            </span>
          </div>
          <span className="text-border" aria-hidden="true">·</span>
          <div aria-label={`${categoryCount} categories`}>
            <span className="text-2xl font-bold text-primary">{categoryCount}</span>
            <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
              Categories
            </span>
          </div>
        </div>
      </div>

      {/* Rendered at the bottom of the hero viewport */}
      {children && (
        <div className="relative z-10 w-full">{children}</div>
      )}
    </section>
  );
}
