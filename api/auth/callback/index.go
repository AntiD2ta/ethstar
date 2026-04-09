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

// Package callback implements the Vercel serverless function for /api/auth/callback.
// It validates the OAuth state, exchanges the code for a token, and redirects
// with the token in the URL fragment.
package callback

import (
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"

	"ethstar/internal/auth"
)

// secureCookie is derived once per cold start from BASE_URL scheme.
// Default false (safe for dev); true only when BASE_URL uses https.
var secureCookie = func() bool {
	if u, err := url.Parse(os.Getenv("BASE_URL")); err == nil && u.Scheme == "https" {
		return true
	}
	return false
}()

// Handler is the Vercel serverless entrypoint.
func Handler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	clientID := os.Getenv("GITHUB_CLIENT_ID")
	clientSecret := os.Getenv("GITHUB_CLIENT_SECRET")
	baseURL := os.Getenv("BASE_URL")

	if clientID == "" || clientSecret == "" {
		slog.Error("missing required env vars (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)")
		http.Error(w, "server misconfiguration", http.StatusInternalServerError)
		return
	}

	// Defense-in-depth: validate BASE_URL host against allowlist.
	// ALLOWED_HOSTS env var is comma-separated (e.g. "ethstar.org,*.vercel.app").
	var allowedHosts []string
	if h := os.Getenv("ALLOWED_HOSTS"); h != "" {
		allowedHosts = strings.Split(h, ",")
		for i, entry := range allowedHosts {
			allowedHosts[i] = strings.TrimSpace(entry)
		}
	}
	if err := auth.ValidateBaseURLHost(baseURL, allowedHosts); err != nil {
		slog.Error("invalid BASE_URL", "error", err) // #nosec G706
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

	tokenResp, err := auth.ExchangeCode(r.Context(), auth.GitHubTokenURL, clientID, clientSecret, code)
	if err != nil {
		slog.Error("token exchange failed", "error", err) // #nosec G706
		http.Error(w, "authentication failed", http.StatusBadGateway)
		return
	}

	// Clear state cookie — it's no longer needed.
	auth.ClearStateCookie(w, secureCookie)

	// Redirect with token in URL fragment (not query string — fragment stays client-side).
	fragment := url.Values{}
	fragment.Set("access_token", tokenResp.AccessToken)
	fragment.Set("expires_in", strconv.Itoa(tokenResp.ExpiresIn))
	if tokenResp.RefreshToken != "" {
		fragment.Set("refresh_token", tokenResp.RefreshToken)
	}

	redirectURL := fmt.Sprintf("%s/#%s", baseURL, fragment.Encode())
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}
