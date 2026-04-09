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
	"log/slog"
	"net/http"
	"net/url"
	"strconv"

	"ethstar/internal/auth"
)

// handleAuthGitHub generates a random state, sets it in an HttpOnly cookie,
// and redirects the browser to the GitHub App authorization URL.
func handleAuthGitHub(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.GitHubClientID == "" {
			slog.Error("GITHUB_CLIENT_ID not set")
			http.Error(w, "server misconfiguration", http.StatusInternalServerError)
			return
		}

		state, err := auth.GenerateState()
		if err != nil {
			slog.Error("generating state", "error", err) // #nosec G706
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		auth.SetStateCookie(w, state, cfg.CookieSecure)

		authURL := auth.BuildAuthURL(cfg.GitHubClientID, state)
		http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
	}
}

// handleAuthCallback validates the oauth_state cookie, exchanges the code for
// an access token, and redirects back to the frontend with the token in the
// URL fragment (so it stays client-side).
func handleAuthCallback(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.GitHubClientID == "" || cfg.GitHubClientSecret == "" || cfg.BaseURL == "" {
			slog.Error("missing required config (GitHubClientID, GitHubClientSecret, BaseURL)")
			http.Error(w, "server misconfiguration", http.StatusInternalServerError)
			return
		}

		if err := auth.ValidateState(r); err != nil {
			slog.Error("state validation failed", "error", err) // #nosec G706
			http.Error(w, "invalid state", http.StatusBadRequest)
			return
		}

		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "missing code parameter", http.StatusBadRequest)
			return
		}

		tokenResp, err := auth.ExchangeCode(r.Context(), cfg.tokenURL(), cfg.GitHubClientID, cfg.GitHubClientSecret, code)
		if err != nil {
			slog.Error("token exchange failed", "error", err) // #nosec G706
			http.Error(w, "authentication failed", http.StatusBadGateway)
			return
		}

		auth.ClearStateCookie(w, cfg.CookieSecure)

		fragment := url.Values{}
		fragment.Set("access_token", tokenResp.AccessToken)
		fragment.Set("expires_in", strconv.Itoa(tokenResp.ExpiresIn))
		if tokenResp.RefreshToken != "" {
			fragment.Set("refresh_token", tokenResp.RefreshToken)
		}

		redirectURL := fmt.Sprintf("%s/#%s", cfg.BaseURL, fragment.Encode())
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
	}
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// handleAuthRefresh exchanges a refresh token for a new access token. The
// client sends the refresh token in the POST body (not a cookie), so no
// CORS credentials are required.
func handleAuthRefresh(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.GitHubClientID == "" || cfg.GitHubClientSecret == "" {
			slog.Error("missing required config (GitHubClientID, GitHubClientSecret)")
			http.Error(w, "server misconfiguration", http.StatusInternalServerError)
			return
		}

		r.Body = http.MaxBytesReader(nil, r.Body, 1<<20)
		var req refreshRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if req.RefreshToken == "" {
			http.Error(w, "missing refresh_token", http.StatusBadRequest)
			return
		}

		tokenResp, err := auth.RefreshToken(r.Context(), cfg.tokenURL(), cfg.GitHubClientID, cfg.GitHubClientSecret, req.RefreshToken)
		if err != nil {
			slog.Error("token refresh failed", "error", err) // #nosec G706
			http.Error(w, "refresh failed", http.StatusBadGateway)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(tokenResp); err != nil {
			slog.Error("encoding response", "error", err) // #nosec G706
		}
	}
}
