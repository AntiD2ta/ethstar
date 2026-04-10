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

import { useState } from "react";
import { Check, Coffee, Copy, Heart, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SupportSectionProps {
  sponsorsUrl?: string;
  kofiUrl?: string;
  ethAddress?: string;
}

export function SupportSection({
  sponsorsUrl = "https://github.com/sponsors/AntiD2ta",
  kofiUrl = "https://ko-fi.com/antid2ta",
  ethAddress = "0x03574b4bbb883a790234d200b6c3c74f1c4a8bfd",
}: SupportSectionProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!ethAddress) return;
    navigator.clipboard
      .writeText(ethAddress)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard unavailable — ignore silently.
      });
  }

  return (
    <footer aria-labelledby="support-heading" className="flex flex-col items-center gap-4 border-t border-border px-6 py-12 text-center">
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
            href={sponsorsUrl}
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
            href={kofiUrl}
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
            href="https://github.com/AntiD2ta/ethstar/blob/main/MAINTAINERS.md#repo-list-changes"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Propose more repos"
          >
            <ListPlus aria-hidden="true" />
            Propose more repos
          </a>
        </Button>
        {ethAddress && (
          <Button
            variant="outline"
            onClick={handleCopy}
            className="rounded-full font-mono text-xs"
            aria-label="Copy Ethereum address"
          >
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? "Copied!" : `${ethAddress.slice(0, 6)}…${ethAddress.slice(-4)}`}
          </Button>
        )}
      </div>
    </footer>
  );
}
