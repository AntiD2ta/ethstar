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

import { memo } from "react";
import { KeyRound, Eraser, BookOpenCheck, UserCheck } from "lucide-react";

interface TrustStripSectionProps {
  repoCount: number;
  formattedStars: string;
  /** True once live stargazer data has loaded. When false the coverage
   *  value uses an `~` prefix and is dimmed to signal placeholder status. */
  starsAreLive: boolean;
}

type IconComponent = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

interface TrustItemData {
  icon: IconComponent;
  label: string;
  /** Static value. Omit for the Coverage slot, which synthesizes its value
   *  from live repoCount/formattedStars props at render time. */
  value?: string;
  detail: string;
  /** Explicit opt-in for the dim-while-loading visual treatment. Only the
   *  Coverage slot uses it today; decoupling it from `value === undefined`
   *  means a future item that omits `value` won't accidentally dim. */
  dimWhenLoading?: true;
}

// Two separate OAuth handshakes back this app: a read-only GitHub App for
// sign-in (cookie session) and a classic OAuth App with `public_repo` for
// the actual starring (ephemeral popup token). Naming both on the landing
// page preempts the "wait, why does it want write access?" moment at the
// GitHub consent screen — GitHub describes `public_repo` as "Access public
// repositories," which sounds broader than what we do with it.
const TRUST_ITEMS: ReadonlyArray<TrustItemData> = [
  {
    icon: UserCheck,
    label: "Sign in",
    value: "GitHub App (read-only)",
    detail:
      "Identifies you so we can look up what you've already starred. Backed by a cookie — revoke anytime in GitHub → Settings → Applications.",
  },
  {
    icon: KeyRound,
    label: "Starring scope",
    value: "public_repo",
    detail:
      "GitHub's narrowest scope that permits starring. It also permits writes to public repos — we only ever use it to add stars.",
  },
  {
    icon: Eraser,
    label: "Starring token",
    value: "Used once, then discarded",
    detail:
      "Obtained fresh from a popup for each star batch and never stored server-side. Separate from your sign-in session.",
  },
  {
    icon: BookOpenCheck,
    label: "Coverage",
    dimWhenLoading: true,
    detail: "Curated fundamental repositories across the Ethereum ecosystem.",
  },
];

// Trust strip replaces the prior "How It Works" card grid. The hero +
// StarModal already narrate authenticate → star → support; repeating the
// same three steps as labeled cards read as AI template filler and added
// cognitive weight instead of trust. The four disclosures here (sign-in,
// starring scope, starring token, coverage) earn their space by saying
// something the user doesn't already know from the hero, and by separating
// the two auth mechanisms so neither surprises them at GitHub's consent
// screens. Asymmetric top/bottom padding gives the heading visual breathing
// room above the marquee tail of the Saturn ring without pushing the repo
// list too far down.
export const TrustStripSection = memo(function TrustStripSection({
  repoCount,
  formattedStars,
  starsAreLive,
}: TrustStripSectionProps) {
  const coverageValue = `${repoCount} repos · ${formattedStars} stars`;
  return (
    <section
      aria-labelledby="trust-strip-heading"
      className="flex flex-col items-center gap-6 px-4 pt-20 pb-14 md:gap-8 md:px-6 md:pt-28 md:pb-20"
    >
      <h2
        id="trust-strip-heading"
        className="font-heading text-h2 font-bold tracking-tight"
      >
        What we ask — and what we don&apos;t
      </h2>

      <ul
        data-testid="trust-strip"
        className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 md:gap-6"
      >
        {TRUST_ITEMS.map((item) => (
          <TrustItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            value={item.value ?? coverageValue}
            detail={item.detail}
            dimValue={item.dimWhenLoading === true && !starsAreLive}
          />
        ))}
      </ul>
    </section>
  );
});

interface TrustItemProps {
  icon: IconComponent;
  label: string;
  value: string;
  detail: string;
  /** When true, renders the primary value at reduced opacity to signal
   *  placeholder/fallback status. Used while live stargazer data loads. */
  dimValue?: boolean;
}

function TrustItem({ icon: Icon, label, value, detail, dimValue }: TrustItemProps) {
  return (
    <li className="flex flex-1 flex-col gap-2 text-left">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        <span className="font-heading text-[10px] uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p
        className={`font-heading text-base font-semibold text-foreground transition-opacity duration-500 md:text-lg ${dimValue ? "opacity-60" : "opacity-100"}`}
      >
        {value}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground md:text-sm">
        {detail}
      </p>
    </li>
  );
}
