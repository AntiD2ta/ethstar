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

import { useCallback, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, OctagonX, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { STAR_OAUTH_ERROR } from "@/hooks/use-star-oauth";
import type { StarProgress } from "@/lib/types";

type Step = "warning" | "authorizing" | "progress" | "complete" | "stopped";

type StarResult = { starred: number; failed: number; aborted: boolean };

// Single source of truth for the popup-blocked message. Kept as a module
// constant so the three places that reference it (setAuthError, the help
// banner gate, and the generic-error banner negation) stay synchronized.
const POPUP_BLOCKED_MSG =
  "Popup was blocked. Please allow popups for this site and try again.";

interface StarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unstarredCount: number;
  progress: StarProgress;
  onStartStarring: (token: string) => Promise<StarResult>;
  requestToken: () => Promise<string>;
  cancelOAuth: () => void;
  starResult: StarResult | null;
  onOpenManualModal: () => void;
  /** Abort the in-flight starring loop after the current PUT finishes.
   *  Rendered inside the progress step so the button sits inside Radix's
   *  DismissableLayer tree and is actually clickable (the RoamingStar portal
   *  rendered outside gets its pointer events swallowed by the dialog
   *  overlay). */
  onCancelStarring: () => void;
  /** When true, the OAuth popup was blocked on the last attempt. Surfaces
   *  inline recovery help on the warning step. Separate from `authError`
   *  because popup-blocked needs its own non-dismissable guidance rather
   *  than a generic error banner. */
  popupBlocked?: boolean;
}

// The parent should pass a `key` that changes each time the modal opens
// (e.g. an incrementing counter). This remounts the component and resets
// all internal state (step, authError) to their initial values.
export function StarModal({
  open,
  onOpenChange,
  unstarredCount,
  progress,
  onStartStarring,
  requestToken,
  cancelOAuth,
  starResult,
  onOpenManualModal,
  onCancelStarring,
  popupBlocked,
}: StarModalProps) {
  const [step, setStep] = useState<Step>("warning");
  const [authError, setAuthError] = useState<string | null>(null);

  const handleProceed = useCallback(async () => {
    setStep("authorizing");
    setAuthError(null);
    try {
      const token = await requestToken();
      setStep("progress");
      const result = await onStartStarring(token);
      // An aborted run routes to the "stopped" terminal state so the user
      // sees exactly how many repos were starred before they hit
      // "Stop after current" — distinct visual from the success/failure
      // complete state, using the same result record.
      setStep(result.aborted ? "stopped" : "complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg === STAR_OAUTH_ERROR.POPUP_BLOCKED) {
        setAuthError(POPUP_BLOCKED_MSG);
        setStep("warning");
      } else if (msg === STAR_OAUTH_ERROR.POPUP_CLOSED) {
        setAuthError("Authorization window was closed. Click \"Star all\" to try again.");
        setStep("warning");
      } else if (msg === STAR_OAUTH_ERROR.CANCELLED) {
        setStep("warning");
      } else if (msg === STAR_OAUTH_ERROR.TIMEOUT) {
        setAuthError("Authorization timed out. Please try again.");
        setStep("warning");
      } else {
        setAuthError(`Authorization failed: ${msg}`);
        setStep("warning");
      }
    }
  }, [requestToken, onStartStarring]);

  const handleManual = useCallback(() => {
    onOpenChange(false);
    onOpenManualModal();
  }, [onOpenChange, onOpenManualModal]);

  const stepAnnouncement =
    step === "warning" ? "Authorization required"
    : step === "authorizing" ? "Authorizing with GitHub"
    : step === "progress" ? "Starring repositories in progress"
    : step === "stopped" && starResult ? `Stopped: ${starResult.starred} of ${progress.total} starred`
    : starResult ? `Complete: ${starResult.starred} starred, ${starResult.failed} failed`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={step !== "progress"}
        // During the progress step the RoamingStar owns the visual surface;
        // the dialog shell exists only for Radix focus-trap + inert-page.
        // Render as a transparent, no-border, no-size invisible container
        // so the star flies free in center. Clicks still pass through
        // Radix's DismissableLayer onto child interactive elements
        // (counter + Cancel) because they live inside this portal tree.
        className={
          step === "progress"
            ? "pointer-events-none border-0 bg-transparent p-0 shadow-none max-w-none w-auto [&>button[aria-label='Close']]:hidden z-[60]"
            : undefined
        }
        onInteractOutside={(e) => {
          if (step === "progress" || step === "authorizing") {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (step === "progress") {
            e.preventDefault();
          }
        }}
      >
        {/* Visually-hidden live region announces step transitions to screen readers */}
        <div aria-live="assertive" className="sr-only">{stepAnnouncement}</div>

        {step === "warning" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-amber-400" aria-hidden="true" />
                Authorization Required
              </DialogTitle>
              <DialogDescription>
                This will add a star to <strong>{unstarredCount} public repositories</strong>{" "}
                on your GitHub account. The starred list is visible on your public profile.
              </DialogDescription>
              {/* Sibling <p> rather than nested inside DialogDescription —
                  Radix Description is a <p>, can't nest paragraphs. */}
              <p className="text-sm text-muted-foreground">
                Starring requires the <code className="rounded bg-muted px-1 text-xs">public_repo</code> scope —
                broader than we&apos;d like, but it&apos;s a GitHub limitation. Continuing opens a popup where you can authorize our OAuth app.
              </p>
            </DialogHeader>

            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span>Your token is used <strong>once</strong> to star repos, then <strong>immediately discarded</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span>It is never stored, sent to our server, or logged.</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span>You can revoke access anytime at{" "}
                  <a
                    href="https://github.com/settings/applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    GitHub Settings
                    <ExternalLink className="ml-0.5 inline size-3" aria-hidden="true" />
                  </a>
                </span>
              </div>
            </div>

            {(popupBlocked || authError === POPUP_BLOCKED_MSG) && (
              <div
                role="alert"
                data-testid="popup-blocked-help"
                className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Popup blocked by your browser. Allow popups for this site and
                  click &quot;Star all&quot; again. See{" "}
                  <a
                    href="https://support.google.com/chrome/answer/95472"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-100"
                  >
                    how to enable popups
                    <ExternalLink className="ml-0.5 inline size-3" aria-hidden="true" />
                  </a>
                  .
                </span>
              </div>
            )}

            {authError && authError !== POPUP_BLOCKED_MSG && (
              <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {authError}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleManual}>
                Star manually instead
              </Button>
              <Button onClick={handleProceed}>
                Star all {unstarredCount}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "authorizing" && (
          <>
            <DialogHeader>
              <DialogTitle>Authorizing with GitHub…</DialogTitle>
              <DialogDescription>
                A popup window has opened. Complete the authorization there.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="size-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Waiting for authorization…
              </p>
            </div>

            {authError && (
              <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {authError}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  cancelOAuth();
                  setStep("warning");
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "progress" && (
          // Progress step: the RoamingStar takes over as the visual progress
          // indicator in center viewport. The modal shell stays mounted for
          // Radix focus-trap + inert-page semantics. The counter + Cancel
          // UI live *inside* this DialogContent so Radix's DismissableLayer
          // doesn't swallow the Cancel button's click (anything rendered
          // outside the dialog portal gets its pointer events intercepted).
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Starring Repositories</DialogTitle>
              <DialogDescription>
                {progress.starred} of {progress.total} repositories starred.
              </DialogDescription>
            </DialogHeader>
            <div aria-live="polite" className="sr-only">
              {progress.current ? `Starring ${progress.current}` : null}
            </div>
            {/* Counter + help + Cancel cluster. Fixed-positioned at ~55%
                viewport so it lands visually beneath the RoamingStar's
                spinning diamond (star center: 45% viewport, half-height
                ≈ 67px, +24px gap). `pointer-events-auto` reactivates
                clicks on just this cluster — the rest of DialogContent is
                `pointer-events-none` so the Radix overlay's dim-only
                behavior is preserved over the surrounding page. */}
            <div
              className="pointer-events-auto fixed left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
              style={{ top: "calc(45% + 92px)" }}
            >
              <p
                role="status"
                aria-live="polite"
                data-testid="takeover-counter"
                className="font-heading text-xl font-bold tracking-tight whitespace-nowrap text-foreground"
              >
                Starring {progress.starred} / {progress.total}
              </p>
              {/* Scope sublabel — rewritten from the uppercase-tracked 11px
                  register (unreadable at 65% opacity on a dim scrim, photo
                  2026-04-15) to a natural-case 13px italic at 85% opacity.
                  Drops the tracking/caps styling that fought the glass bg;
                  italic signals "aside, context" rather than competing with
                  the bold counter above. */}
              <p className="whitespace-nowrap text-[13px] italic text-foreground/85">
                on your GitHub account
              </p>
              <button
                type="button"
                onClick={onCancelStarring}
                data-testid="takeover-cancel"
                className="mt-1 whitespace-nowrap rounded-full border border-border bg-background/70 px-4 py-1.5 text-xs font-medium text-foreground/85 backdrop-blur hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Stop after current
              </button>
            </div>
          </>
        )}

        {step === "complete" && (
          <>
            <DialogHeader>
              <DialogTitle>
                {starResult && starResult.failed === 0
                  ? "All Done!"
                  : "Starring Complete"}
              </DialogTitle>
              <DialogDescription>
                {starResult && starResult.starred > 0 && (
                  <span>Successfully starred {starResult.starred} repos. </span>
                )}
                {starResult && starResult.failed > 0 && (
                  <span>{starResult.failed} repos failed — you can retry them individually. </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4 text-center">
              {starResult && starResult.failed === 0 ? (
                <div className="text-4xl" aria-hidden="true">&#11088;</div>
              ) : (
                <div className="text-4xl" aria-hidden="true">&#9888;&#65039;</div>
              )}
              <p className="text-sm text-muted-foreground">
                Your GitHub token has been discarded.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </>
        )}

        {step === "stopped" && (
          <div data-testid="star-modal-stopped">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <OctagonX className="size-5 text-muted-foreground" aria-hidden="true" />
                Stopped at {starResult?.starred ?? 0} of {progress.total}
              </DialogTitle>
              <DialogDescription>
                {starResult && starResult.starred > 0
                  ? `${starResult.starred} ${starResult.starred === 1 ? "repo" : "repos"} starred before you stopped. `
                  : "No repos were starred. "}
                You can reopen the flow and pick up the remaining {progress.remaining} later.
              </DialogDescription>
            </DialogHeader>

            <p className="mt-2 text-sm text-muted-foreground">
              Your GitHub token has been discarded.
            </p>

            <DialogFooter className="mt-4">
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
