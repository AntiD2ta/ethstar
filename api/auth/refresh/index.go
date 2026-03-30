// Package refresh implements the Vercel serverless function for /api/auth/refresh.
// It exchanges a refresh token for a new access token.
package refresh

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"

	"ethstar/internal/auth"
)

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// Handler is the Vercel serverless entrypoint.
func Handler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	clientID := os.Getenv("GITHUB_CLIENT_ID")
	clientSecret := os.Getenv("GITHUB_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		slog.Error("missing required env vars (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)")
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

	tokenResp, err := auth.RefreshToken(r.Context(), auth.GitHubTokenURL, clientID, clientSecret, req.RefreshToken)
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
