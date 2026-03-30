// Package starcallback implements the Vercel serverless function for
// /api/auth/star-callback. It validates the star_oauth_state cookie, exchanges
// the code for a token via the classic OAuth app, and returns HTML that posts
// the token to the opener window via postMessage.
package starcallback

import (
	"encoding/json"
	"fmt"
	"html"
	"log/slog"
	"net/http"
	"net/url"
	"os"
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

	clientID := os.Getenv("OAUTH_CLIENT_ID")
	clientSecret := os.Getenv("OAUTH_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		slog.Error("missing required env vars (OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET)")
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

	auth.ClearNamedStateCookie(w, auth.StarOAuthCookieName, secureCookie)

	tokenResp, err := auth.ExchangeCode(r.Context(), auth.GitHubTokenURL, clientID, clientSecret, code)
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

	// Defense-in-depth: validate BASE_URL host against allowlist.
	// ALLOWED_HOSTS env var is comma-separated (e.g. "ethstar.org,*.vercel.app").
	baseURL := os.Getenv("BASE_URL")
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

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = fmt.Fprintf(w, auth.StarSuccessHTML, tokenJSON, html.EscapeString(baseURL))
}
