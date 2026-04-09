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

// Package star implements the Vercel serverless function for /api/auth/star.
// It generates an OAuth state, sets a star_oauth_state cookie, and redirects
// to the classic GitHub OAuth URL with public_repo scope.
package star

import (
	"log/slog"
	"net/http"
	"net/url"
	"os"

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

	clientID := os.Getenv("OAUTH_CLIENT_ID")
	if clientID == "" {
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

	auth.SetNamedStateCookie(w, auth.StarOAuthCookieName, state, secureCookie)

	authURL := auth.BuildClassicOAuthURL(clientID, state, "public_repo")
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}
