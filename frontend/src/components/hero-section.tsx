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
import { ChalkMark } from "./chalk-mark";
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

/**
 * Scene-centric hero. The 3D rotating diamond (`HeroLogo`) is the stage; the
 * content stacks vertically on the center axis so the star CTA lands inside
 * the diamond's visual footprint. Rhythm is carried by varied vertical gaps
 * (tight H1↔subhead, generous to star, tight star↔browse, generous to stats)
 * rather than by column placement.
 *
 * `primaryCta` is still rendered exactly once — RoamingStar owns its own
 * IntersectionObserver + portal and can't be double-mounted.
 */
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
      className="relative flex min-h-dvh flex-col px-4 py-12 md:px-6 md:py-20 [@media(min-width:768px)_and_(max-height:800px)]:py-10"
    >
      <HeroLogo />

      <div
        data-testid="hero-stack"
        className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center"
      >
        <h1
          data-testid="hero-h1"
          className="font-heading text-display font-bold leading-[0.95] tracking-tight"
        >
          <span className="text-foreground">Support </span>
          <span className="text-eth-highlight">Ethereum&apos;s</span>{" "}
          <span className="relative inline-block text-foreground">
            builders
            <ChalkMark className="pointer-events-none absolute left-0 top-full h-3 w-full -translate-y-1" />
          </span>
        </h1>

        <p
          data-testid="hero-subhead"
          className="mt-6 max-w-[55ch] text-body-lg leading-relaxed text-muted-foreground [@media(min-width:768px)_and_(max-height:800px)]:mt-4"
        >
          One tap stars every core Ethereum open-source repo on your GitHub.
          Each star is a public recognition that tells the teams and devs
          behind them their work matters.
        </p>

        {/* Generous gap — this is the tier break between framing copy and the
            starring moment. The diamond earns the breathing room. */}
        <div className="mt-10 flex items-center justify-center md:mt-12 [@media(min-width:768px)_and_(max-height:800px)]:mt-6">
          {primaryCta}
        </div>

        <button
          type="button"
          onClick={onViewRepositories}
          className="group mt-6 inline-flex items-center gap-1.5 rounded font-heading text-sm font-semibold tracking-tight text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [@media(min-width:768px)_and_(max-height:800px)]:mt-4"
        >
          {primaryCtaPresent
            ? "or browse the repositories"
            : "Browse the repositories"}
          <span
            aria-hidden="true"
            className="text-base leading-none transition-transform group-hover:translate-y-0.5"
          >
            ↓
          </span>
        </button>

        <p
          data-testid="hero-meta"
          className="mt-10 text-caption text-muted-foreground md:mt-14 [@media(min-width:768px)_and_(max-height:800px)]:mt-6"
          aria-label="Site statistics"
        >
          <span className="font-semibold text-primary">{repoCount}+</span>{" "}
          repos ·{" "}
          <span className="font-semibold text-primary">{formattedStars}</span>{" "}
          combined stars ·{" "}
          <span className="font-semibold text-primary">{categoryCount}</span>{" "}
          categories
        </p>
      </div>

      {/* Rendered at the bottom of the hero viewport */}
      {children && <div className="relative z-10 w-full">{children}</div>}
    </section>
  );
}
