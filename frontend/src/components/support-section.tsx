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
import { Coffee, Heart, ListPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ETH_ADDRESS_DISPLAY,
  GITHUB_SPONSORS_URL,
  KOFI_URL,
  MAINTAINERS_URL,
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
    </footer>
  );
}
