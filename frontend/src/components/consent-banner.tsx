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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useConsent } from "@/lib/consent-context";

/** Prevent auto-close on outside click / escape until the user makes a choice. */
function preventClose(e: Event) {
  e.preventDefault();
}

export function ConsentBanner() {
  const { consent, bannerOpen, acceptAll, rejectAll, setCategory, closeBanner } =
    useConsent();

  // Policy links open in a new tab: the first-visit banner is hard-modal, so
  // same-tab nav would leave the modal overlaying the policy page.
  const [prefsOpen, setPrefsOpen] = useState(false);

  // Pre-seed the preferences toggle from current consent (or `false` first-visit).
  const [prefStatistics, setPrefStatistics] = useState<boolean>(
    consent?.statistics ?? false,
  );

  // No choice yet ⇒ modal is hard-modal (cannot be dismissed without choosing).
  const firstVisit = consent === null;

  function handleOpenChange(open: boolean) {
    if (open) return;
    // Allow close only if a choice is already stored (re-opened via footer).
    if (!firstVisit) closeBanner();
  }

  function openPreferences() {
    setPrefStatistics(consent?.statistics ?? false);
    setPrefsOpen(true);
  }

  function savePreferences() {
    setCategory("statistics", prefStatistics);
    setPrefsOpen(false);
  }

  return (
    <>
      <Dialog open={bannerOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={!firstVisit}
          onPointerDownOutside={firstVisit ? preventClose : undefined}
          onEscapeKeyDown={firstVisit ? preventClose : undefined}
          onInteractOutside={firstVisit ? preventClose : undefined}
          className="sm:max-w-xl"
          data-testid="consent-banner"
        >
          <DialogHeader>
            <DialogTitle>Cookies & your privacy</DialogTitle>
            <DialogDescription>
              We use strictly necessary storage to keep you signed in and to
              cache GitHub data. With your consent, we also collect anonymous
              analytics (via Vercel) to understand how the site is used. You
              can change your choice at any time from the footer.
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Read our{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href="/cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Cookies Policy
            </a>
            .
          </p>

          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={openPreferences}
              data-testid="consent-preferences"
            >
              Preferences
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={rejectAll}
                data-testid="consent-reject"
              >
                Reject all
              </Button>
              <Button onClick={acceptAll} data-testid="consent-accept">
                Accept all
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="consent-preferences-dialog">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>
              Turn off categories you don&apos;t want. Strictly necessary
              storage keeps the site working and can&apos;t be disabled.
            </DialogDescription>
          </DialogHeader>

          <ul className="flex flex-col gap-4">
            <li className="flex items-start justify-between gap-4 rounded-md border border-border p-4">
              <div className="flex flex-col gap-1">
                <Label className="text-sm font-semibold">Strictly necessary</Label>
                <p className="text-xs text-muted-foreground">
                  OAuth session, auth tokens, cached repo metadata, pending
                  stats queue, and this consent record. Always on.
                </p>
              </div>
              <Switch checked disabled aria-label="Strictly necessary (always on)" />
            </li>
            <li className="flex items-start justify-between gap-4 rounded-md border border-border p-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="pref-statistics" className="text-sm font-semibold">
                  Statistics
                </Label>
                <p className="text-xs text-muted-foreground">
                  Vercel Analytics and Speed Insights. No cross-site tracking.
                  Data is aggregated to help us improve the site.
                </p>
              </div>
              <Switch
                id="pref-statistics"
                checked={prefStatistics}
                onCheckedChange={setPrefStatistics}
                aria-label="Statistics cookies"
                data-testid="consent-switch-statistics"
              />
            </li>
          </ul>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPrefsOpen(false)}
              data-testid="consent-preferences-cancel"
            >
              Cancel
            </Button>
            <Button onClick={savePreferences} data-testid="consent-preferences-save">
              Save preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
