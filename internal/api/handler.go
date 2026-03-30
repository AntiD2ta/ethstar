// Package api provides HTTP handlers for the application's API.
package api

import (
	"encoding/json"
	"net/http"

	"ethstar/internal/auth"
)

// Config configures the API handlers with the values that differ between
// local development and production serverless deployment.
type Config struct {
	// GitHubClientID is the GitHub App client ID.
	GitHubClientID string
	// GitHubClientSecret is the GitHub App client secret.
	GitHubClientSecret string
	// BaseURL is the public URL the browser loads the frontend from.
	// In dev this is typically http://localhost:5173 (Vite). Used as the
	// target of the callback fragment redirect.
	BaseURL string
	// CookieSecure controls whether the oauth_state cookie is marked Secure.
	// Must be false for plaintext http://localhost development, true in
	// production where the site is served over HTTPS.
	CookieSecure bool
	// TokenURL overrides the GitHub OAuth token endpoint. Leave empty to
	// use the real endpoint; set to a test server URL in unit tests.
	TokenURL string
	// OAuthClientID is the classic OAuth App client ID, used for the
	// starring flow which requires the public_repo scope.
	OAuthClientID string
	// OAuthClientSecret is the classic OAuth App client secret.
	OAuthClientSecret string
}

// Handler returns an http.Handler for all API routes.
func Handler(cfg Config) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", handleHealth)
	mux.HandleFunc("GET /api/auth/github", handleAuthGitHub(cfg))
	mux.HandleFunc("GET /api/auth/callback", handleAuthCallback(cfg))
	mux.HandleFunc("POST /api/auth/refresh", handleAuthRefresh(cfg))
	mux.HandleFunc("GET /api/auth/star", handleAuthStar(cfg))
	mux.HandleFunc("GET /api/auth/star-callback", handleAuthStarCallback(cfg))
	mux.HandleFunc("GET /api/stats", handleStatsGET)
	mux.HandleFunc("POST /api/stats", handleStatsPOST)

	return mux
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	}); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}

func (c Config) tokenURL() string {
	if c.TokenURL != "" {
		return c.TokenURL
	}
	return auth.GitHubTokenURL
}
