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

package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ethstar/internal/api"

	"github.com/stretchr/testify/require"
)

func TestStatsGET(t *testing.T) {
	h := api.Handler(newTestConfig(""))
	req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	resp := w.Result()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		TotalStars int `json:"total_stars"`
		TotalUsers int `json:"total_users"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, 0, body.TotalStars)
	require.Equal(t, 0, body.TotalUsers)
}

func TestStatsPOST(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
	}{
		{
			name:       "AcceptsValidPayload",
			body:       `{"stars": 5}`,
			wantStatus: http.StatusNoContent,
		},
		{
			name:       "RejectsInvalidJSON",
			body:       `not json`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "RejectsZeroStars",
			body:       `{"stars": 0}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "RejectsNegativeStars",
			body:       `{"stars": -1}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "RejectsOverMaxStars",
			body:       `{"stars": 101}`,
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			h := api.Handler(newTestConfig(""))
			req := httptest.NewRequest(http.MethodPost, "/api/stats", strings.NewReader(test.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			h.ServeHTTP(w, req)

			require.Equal(t, test.wantStatus, w.Result().StatusCode)
		})
	}
}

func TestStatsMethodNotAllowed(t *testing.T) {
	h := api.Handler(newTestConfig(""))
	req := httptest.NewRequest(http.MethodPut, "/api/stats", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	require.Equal(t, http.StatusMethodNotAllowed, w.Result().StatusCode)
}
