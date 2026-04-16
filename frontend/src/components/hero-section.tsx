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
 * Asymmetric, editorial hero. The H1 frames *why* the user is here; the
 * dormant-star slot is the visual peer that says *what to tap*. The 3-stat
 * tile row is collapsed into a single muted meta line.
 *
 * The grid uses `order` + `col-span` + `row-span` so `primaryCta` is rendered
 * exactly once (RoamingStar owns its own DOM observer and can't be
 * double-mounted) but moves between source-order on `<md` and a right-column
 * peer on `≥md`. See `plan/hero-reframe-brief.md`.
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

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center md:gap-10 [@media(min-width:768px)_and_(max-height:800px)]:gap-5">
          <h1
            data-testid="hero-h1"
            className="order-1 font-heading text-display font-bold leading-[0.95] tracking-tight md:col-span-7"
          >
            <span className="text-foreground">Support </span>
            <span className="text-eth-highlight">Ethereum&apos;s</span>{" "}
            <span className="relative inline-block text-foreground">
              builders
              <ChalkMark className="pointer-events-none absolute left-0 top-full h-3 w-full -translate-y-1" />
            </span>
          </h1>

          {/* Dormant-star peer slot.
              On <md: order-2 — sits between H1 and subhead so the gold star
              wins first-read on touch devices.
              On ≥md: col-span-5 + row-span-4 — vertical peer to the H1+supporting
              copy stack, placed in the right column (order 2 > h1's order 1, so
              grid auto-placement fills H1 into cols 1–7 first, then star into
              cols 8–12, rows 1–4). Rendered exactly once (RoamingStar can't be
              double-mounted because it owns its own IntersectionObserver +
              portal). */}
          <div className="order-2 flex justify-center md:col-span-5 md:row-span-4 md:items-center md:justify-center">
            {primaryCta}
          </div>

          <p
            data-testid="hero-subhead"
            className="order-3 max-w-[60ch] text-body-lg leading-relaxed text-muted-foreground md:col-span-7"
          >
            One tap stars every core Ethereum open-source repo on your GitHub.
            Each star is a public recognition that tells the teams and devs
            behind them their work matters.
          </p>

          <button
            type="button"
            onClick={onViewRepositories}
            className="group order-4 inline-flex items-center gap-1.5 self-start rounded font-heading text-sm font-semibold tracking-tight text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:col-span-7"
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
            className="order-5 text-caption text-muted-foreground md:col-span-7"
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
      </div>

      {/* Rendered at the bottom of the hero viewport */}
      {children && <div className="relative z-10 w-full">{children}</div>}
    </section>
  );
}
