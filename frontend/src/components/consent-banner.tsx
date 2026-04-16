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
import { X } from "lucide-react";
import { Link } from "react-router";
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

type BannerView = "main" | "preferences";

// Main view is a non-blocking bottom sheet — pinned to the viewport bottom,
// never dims the hero, never intercepts clicks on the hero CTA. GDPR
// compliance is preserved by gating optional scripts on
// `consent.statistics === true` in `consent-aware-analytics.tsx` rather than
// by hard-modalling the UI. The preferences pane stays a proper modal
// Dialog because fine-grained toggles benefit from focus-trap.
export function ConsentBanner() {
  const { consent, bannerOpen, acceptAll, rejectAll, savePreferences, closeBanner } =
    useConsent();

  const [view, setView] = useState<BannerView>("main");

  // Pre-seed the preferences toggle from current consent (or `false` on first visit).
  // Re-seeded whenever the preferences view is opened so external changes to
  // `consent` propagate next time the user opens the pane.
  const [prefStatistics, setPrefStatistics] = useState<boolean>(
    consent?.statistics ?? false,
  );

  // First-visit = no stored choice. Bottom sheet persists (no close button)
  // until the user makes a choice. Preferences modal still prevents
  // outside-click + Escape dismissal on first visit so the user can't
  // accidentally bypass consent capture.
  const firstVisit = consent === null;

  function handlePreferencesOpenChange(open: boolean) {
    if (open) return;
    setView("main");
  }

  function openPreferences() {
    setPrefStatistics(consent?.statistics ?? false);
    setView("preferences");
  }

  function cancelPreferences() {
    setView("main");
  }

  function handleAcceptAll() {
    setView("main");
    acceptAll();
  }

  function handleRejectAll() {
    setView("main");
    rejectAll();
  }

  function handleSavePreferences() {
    setView("main");
    savePreferences({ statistics: prefStatistics });
  }

  function handleClose() {
    if (firstVisit) return;
    setView("main");
    closeBanner();
  }

  if (!bannerOpen) return null;

  return (
    <>
      {view === "main" && (
        <section
          aria-label="Cookie preferences"
          data-testid="consent-banner"
          className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-3xl px-3 pb-3 sm:px-4 sm:pb-4"
        >
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-background/95 p-4 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="text-xs text-muted-foreground sm:text-sm">
              We use strictly necessary storage and, with your consent,
              anonymous analytics (Vercel).{" "}
              <Link
                to="/cookies"
                className="underline hover:text-foreground"
                data-testid="consent-cookies-link"
              >
                Cookies policy
              </Link>
              .
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <button
                type="button"
                onClick={openPreferences}
                className="text-xs text-muted-foreground underline hover:text-foreground"
                data-testid="consent-preferences"
              >
                Customize
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRejectAll}
                data-testid="consent-reject"
              >
                Essential only
              </Button>
              <Button
                size="sm"
                onClick={handleAcceptAll}
                data-testid="consent-accept"
              >
                Accept all
              </Button>
              {!firstVisit && (
                <button
                  type="button"
                  aria-label="Close cookie preferences"
                  onClick={handleClose}
                  className="ml-1 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <Dialog
        open={view === "preferences"}
        onOpenChange={handlePreferencesOpenChange}
      >
        <DialogContent
          showCloseButton={!firstVisit}
          onPointerDownOutside={firstVisit ? preventClose : undefined}
          onEscapeKeyDown={firstVisit ? preventClose : undefined}
          onInteractOutside={firstVisit ? preventClose : undefined}
          className="sm:max-w-xl"
          data-testid="consent-preferences-dialog"
        >
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>
              Turn off categories you don&apos;t want. Strictly necessary
              storage keeps the site working and can&apos;t be disabled.
            </DialogDescription>
          </DialogHeader>

          <ul className="mt-4 flex flex-col gap-4">
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

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={cancelPreferences}
              data-testid="consent-preferences-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePreferences}
              data-testid="consent-preferences-save"
            >
              Save preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
