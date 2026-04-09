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
