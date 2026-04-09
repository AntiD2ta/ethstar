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

package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORS_PreflightSetsAllHeaders(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called on OPTIONS")
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/test", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusNoContent)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("Allow-Origin = %q, want %q", got, "http://localhost:5173")
	}
	if got := rr.Header().Get("Access-Control-Allow-Methods"); got == "" {
		t.Error("Allow-Methods should be set on preflight")
	}
	if got := rr.Header().Get("Access-Control-Allow-Headers"); got == "" {
		t.Error("Allow-Headers should be set on preflight")
	}
	if got := rr.Header().Get("Access-Control-Max-Age"); got == "" {
		t.Error("Max-Age should be set on preflight")
	}
}

func TestCORS_NonPreflightOmitsMethodsAndHeaders(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("Allow-Origin = %q, want %q", got, "http://localhost:5173")
	}
	// Non-preflight requests should NOT have these headers
	if got := rr.Header().Get("Access-Control-Allow-Methods"); got != "" {
		t.Errorf("Allow-Methods should NOT be set on non-preflight, got %q", got)
	}
	if got := rr.Header().Get("Access-Control-Allow-Headers"); got != "" {
		t.Errorf("Allow-Headers should NOT be set on non-preflight, got %q", got)
	}
	if got := rr.Header().Get("Access-Control-Max-Age"); got != "" {
		t.Errorf("Max-Age should NOT be set on non-preflight, got %q", got)
	}
}

func TestCORS_DisallowedOriginPreflight(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called on OPTIONS")
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/test", nil)
	req.Header.Set("Origin", "http://evil.com")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Allow-Origin should be empty for disallowed origin, got %q", got)
	}
}
