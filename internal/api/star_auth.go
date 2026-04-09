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

package api

import (
	"encoding/json"
	"fmt"
	"html"
	"log/slog"
	"net/http"

	"ethstar/internal/auth"
)

// handleAuthStar generates a random state, sets it in a star_oauth_state
// cookie, and redirects to the classic GitHub OAuth URL with public_repo scope.
// This is the starring-specific OAuth flow — separate from the GitHub App flow.
func handleAuthStar(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.OAuthClientID == "" {
			slog.Error("OAUTH_CLIENT_ID not set")
			http.Error(w, "server misconfiguration", http.StatusInternalServerError)
			return
		}

		state, err := auth.GenerateState()
		if err != nil {
			slog.Error("generating state", "error", err) // #nosec G706
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		auth.SetNamedStateCookie(w, auth.StarOAuthCookieName, state, cfg.CookieSecure)

		authURL := auth.BuildClassicOAuthURL(cfg.OAuthClientID, state, "public_repo")
		http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
	}
}

// handleAuthStarCallback validates the star_oauth_state cookie, exchanges the
// code for an access token using the classic OAuth app credentials, and returns
// an HTML page that posts the token to the opener window via postMessage.
// This runs inside a popup — the HTML closes the popup after delivery.
func handleAuthStarCallback(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.OAuthClientID == "" || cfg.OAuthClientSecret == "" {
			slog.Error("missing required config (OAuthClientID, OAuthClientSecret)")
			http.Error(w, "server misconfiguration", http.StatusInternalServerError)
			return
		}

		if err := auth.ValidateNamedState(r, auth.StarOAuthCookieName); err != nil {
			slog.Error("star state validation failed", "error", err) // #nosec G706
			http.Error(w, "invalid state", http.StatusBadRequest)
			return
		}

		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "missing code parameter", http.StatusBadRequest)
			return
		}

		auth.ClearNamedStateCookie(w, auth.StarOAuthCookieName, cfg.CookieSecure)

		tokenResp, err := auth.ExchangeCode(r.Context(), cfg.tokenURL(), cfg.OAuthClientID, cfg.OAuthClientSecret, code)
		if err != nil {
			slog.Error("star token exchange failed", "error", err) // #nosec G706
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = fmt.Fprintf(w, auth.StarErrorHTML, html.EscapeString(err.Error()))
			return
		}

		tokenJSON, err := json.Marshal(tokenResp.AccessToken)
		if err != nil {
			slog.Error("marshaling token", "error", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = fmt.Fprintf(w, auth.StarSuccessHTML, tokenJSON, html.EscapeString(cfg.BaseURL))
	}
}
