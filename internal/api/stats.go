package api

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// maxStarsPerRequest is the maximum number of stars a single POST can report.
const maxStarsPerRequest = 100

// handleStatsGET returns zeroed counters for the local dev server.
// In production, Vercel KV backs the real counter via api/stats/index.go.
func handleStatsGET(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]int{
		"total_stars": 0,
		"total_users": 0,
	}); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}

// handleStatsPOST accepts and discards star-count reports in local dev.
// It validates the payload shape so frontend integration still exercises
// the real request format, but doesn't persist anything.
func handleStatsPOST(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(nil, r.Body, 1<<20)
	var req struct {
		Stars int `json:"stars"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Stars <= 0 || req.Stars > maxStarsPerRequest {
		http.Error(w, fmt.Sprintf("stars must be between 1 and %d", maxStarsPerRequest), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
