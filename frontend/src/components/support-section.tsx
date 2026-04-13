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

import { Component, lazy, Suspense, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Coffee, Github, Heart, ListPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConsent } from "@/lib/consent-context";
import {
  ETH_ADDRESS_DISPLAY,
  GITHUB_REPO_URL,
  GITHUB_SPONSORS_URL,
  KOFI_URL,
  MAINTAINERS_URL,
  X_PROFILE_URL,
} from "@/lib/constants";

const TipDialog = lazy(() => import("@/components/tip-dialog"));

/** Catches lazy chunk load failures and renders nothing — the dialog
 *  simply won't open, which is acceptable degradation. */
class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

export function SupportSection() {
  const [tipOpen, setTipOpen] = useState(false);
  const { openBanner } = useConsent();

  return (
    <footer aria-labelledby="support-heading" className="flex flex-col items-center gap-4 border-t border-border px-4 py-12 text-center sm:px-6">
      <h2 id="support-heading" className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Support
      </h2>
      <p className="max-w-xl text-sm text-muted-foreground">
        Thanks for keeping this project alive. Contributions help cover domain
        and infrastructure costs.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" asChild className="rounded-full">
          <a
            href={GITHUB_SPONSORS_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Sponsors"
          >
            <Heart aria-hidden="true" />
            GitHub Sponsors
          </a>
        </Button>
        <Button variant="outline" asChild className="rounded-full">
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ko-fi"
          >
            <Coffee aria-hidden="true" />
            Ko-fi
          </a>
        </Button>
        <Button variant="outline" asChild className="rounded-full">
          <a
            href={MAINTAINERS_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Propose more repos"
          >
            <ListPlus aria-hidden="true" />
            Propose more repos
          </a>
        </Button>
        <Button
          variant="outline"
          onClick={() => setTipOpen(true)}
          className="rounded-full font-mono text-xs"
          aria-label="Send ETH tip"
        >
          <Wallet aria-hidden="true" />
          {ETH_ADDRESS_DISPLAY}
        </Button>
      </div>

      <ChunkErrorBoundary>
        <Suspense fallback={null}>
          {tipOpen && <TipDialog open={tipOpen} onOpenChange={setTipOpen} />}
        </Suspense>
      </ChunkErrorBoundary>

      <nav aria-label="Social links" className="flex items-center gap-4">
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Github aria-hidden="true" className="size-5" />
        </a>
        <a
          href={X_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X (Twitter) profile"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {/* X brand mark — not available in lucide-react */}
          <svg
            aria-hidden="true"
            className="size-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      </nav>

      <nav
        aria-label="Legal links"
        className="flex flex-wrap items-center justify-center gap-4 text-xs"
      >
        <Link
          to="/privacy"
          className="text-muted-foreground hover:text-foreground"
        >
          Privacy
        </Link>
        <Link
          to="/cookies"
          className="text-muted-foreground hover:text-foreground"
        >
          Cookies
        </Link>
        <button
          type="button"
          onClick={openBanner}
          className="text-muted-foreground hover:text-foreground"
          data-testid="footer-cookie-preferences"
        >
          Cookie preferences
        </button>
      </nav>

      <p className="text-xs text-muted-foreground">
        &copy; 2026 Miguel Tenorio Potrony
      </p>
    </footer>
  );
}
