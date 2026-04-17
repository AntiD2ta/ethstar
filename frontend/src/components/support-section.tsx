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

import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Check, Coffee, Copy, Github, Heart, ListPlus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConsent } from "@/lib/consent-context";
import {
  ETH_ADDRESS_CHECKSUMMED,
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
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { openBanner } = useConsent();

  // Clear any pending "Copied!" reset on unmount so we don't call a stale
  // state updater after the user navigates away mid-timer. Matches the
  // pattern used by `tip-dialog.tsx` and `share-button.tsx` for consistent
  // clipboard-feedback hygiene across the codebase.
  useEffect(() => () => {
    if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
  }, []);

  // Copy-to-clipboard with a 1.5s "Copied!" affordance. navigator.clipboard
  // is feature-gated because older browsers / insecure contexts may not
  // expose it; we fall back to a toast error and leave the button idle.
  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ETH_ADDRESS_CHECKSUMMED);
      setCopied(true);
      toast.success("Wallet address copied to clipboard");
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false);
        copiedTimerRef.current = null;
      }, 1500);
    } catch {
      toast.error("Couldn't access clipboard — long-press to copy manually.");
    }
  }, []);

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
        {/* Explicit `h-9` aligns this composite pill with the outline
            buttons on its row (shadcn's default size="default" is also h-9).
            Without it the pill under-hung the row by ~6px on desktop. The
            child buttons inherit `h-full` so their click targets stay flush
            with the pill edges. */}
        <div className="inline-flex h-9 items-center rounded-full border border-border">
          <button
            type="button"
            onClick={() => setTipOpen(true)}
            className="inline-flex h-full items-center gap-1.5 rounded-l-full px-3 font-mono text-xs text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Send ETH tip"
          >
            <Wallet className="size-4" aria-hidden="true" />
            {ETH_ADDRESS_DISPLAY}
          </button>
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <button
            type="button"
            onClick={handleCopyAddress}
            className="inline-flex h-full items-center gap-1 rounded-r-full px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={copied ? "Wallet address copied" : "Copy wallet address"}
            data-testid="wallet-copy"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            <span aria-hidden="true">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
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
