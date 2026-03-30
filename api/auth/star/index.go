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
