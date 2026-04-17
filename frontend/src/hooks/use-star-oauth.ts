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

import { useCallback, useEffect, useRef, useState } from "react";

export const STAR_OAUTH_ERROR = {
  POPUP_BLOCKED: "popup_blocked",
  POPUP_CLOSED: "popup_closed",
  CANCELLED: "cancelled",
  TIMEOUT: "timeout",
} as const;

const POPUP_NAME = "ethstar-star-auth";
const POPUP_FEATURES = "width=600,height=700,scrollbars=yes";
const MESSAGE_TYPE = "ethstar-star-token";
const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Popup lifecycle status surfaced for UI driving.
 *  - "idle"    : no request in-flight (either never invoked, or settled).
 *  - "pending" : popup is open and we're waiting for a token.
 *  - "blocked" : the last request failed because the browser blocked the popup.
 *                Stays sticky until the next successful open() call.
 */
export type StarOAuthStatus = "idle" | "pending" | "blocked";

interface StarOAuthReturn {
  /** Open popup and wait for token. Rejects with reason string on failure. */
  requestToken: () => Promise<string>;
  /** True while waiting for the popup to deliver a token. */
  isWaiting: boolean;
  /** Coarse popup-lifecycle signal. See {@link StarOAuthStatus}. */
  status: StarOAuthStatus;
  /** Close the popup and reject the pending promise. */
  cancel: () => void;
}

export function useStarOAuth(): StarOAuthReturn {
  const [isWaiting, setIsWaiting] = useState(false);
  const [status, setStatus] = useState<StarOAuthStatus>("idle");
  const cleanupRef = useRef<(() => void) | null>(null);
  const rejectRef = useRef<((reason: Error) => void) | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (rejectRef.current) {
      rejectRef.current(new Error(STAR_OAUTH_ERROR.CANCELLED));
      rejectRef.current = null;
    }
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setIsWaiting(false);
    setStatus("idle");
  }, []);

  const requestToken = useCallback((): Promise<string> => {
    // Clean up any prior pending request
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const popup = window.open(
      "/api/auth/star",
      POPUP_NAME,
      POPUP_FEATURES,
    );

    if (!popup) {
      setIsWaiting(false);
      setStatus("blocked");
      return Promise.reject(new Error(STAR_OAUTH_ERROR.POPUP_BLOCKED));
    }

    setIsWaiting(true);
    setStatus("pending");

    return new Promise<string>((resolve, reject) => {
      rejectRef.current = reject;

      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        setIsWaiting(false);
        setStatus("idle");
        cleanup();
      };

      // Listen for postMessage from popup
      const onMessage = (event: MessageEvent) => {
        // Only accept messages from our own origin
        if (event.origin !== window.location.origin) return;

        // Only accept messages with the correct type
        if (
          !event.data ||
          event.data.type !== MESSAGE_TYPE ||
          typeof event.data.access_token !== "string"
        ) {
          return;
        }
        resolve(event.data.access_token);
        settle();
      };

      window.addEventListener("message", onMessage);
      // Test hook: signal that the message listener is live so E2E mocks of
      // `window.open` can safely post back without a speculative setTimeout.
      // The attribute is removed in `cleanup` below.
      document.documentElement.setAttribute("data-star-listener-ready", "1");

      // Poll for popup closed by user
      const pollId = setInterval(() => {
        if (popup.closed && !settled) {
          reject(new Error(STAR_OAUTH_ERROR.POPUP_CLOSED));
          settle();
        }
      }, POLL_INTERVAL_MS);

      // Timeout after 5 minutes
      const timeoutId = setTimeout(() => {
        if (!settled) {
          popup.close();
          reject(new Error(STAR_OAUTH_ERROR.TIMEOUT));
          settle();
        }
      }, TIMEOUT_MS);

      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        document.documentElement.removeAttribute("data-star-listener-ready");
        clearInterval(pollId);
        clearTimeout(timeoutId);
        if (!popup.closed) {
          popup.close();
        }
        rejectRef.current = null;
      };

      cleanupRef.current = () => {
        if (!settled) {
          settled = true;
          setIsWaiting(false);
          setStatus("idle");
        }
        cleanup();
      };
    });
  }, []);

  return { requestToken, isWaiting, status, cancel };
}
