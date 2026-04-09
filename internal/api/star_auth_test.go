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
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"ethstar/internal/api"
	"ethstar/internal/auth"

	"github.com/stretchr/testify/require"
)

func newStarTestConfig(tokenURL string) api.Config {
	cfg := newTestConfig(tokenURL)
	cfg.OAuthClientID = "Iv1.star-client-id"
	cfg.OAuthClientSecret = "star-secret"
	return cfg
}

func TestAuthStarRedirect(t *testing.T) {
	t.Run("RedirectsToClassicOAuthURL", func(t *testing.T) {
		h := api.Handler(newStarTestConfig(""))
		req := httptest.NewRequest(http.MethodGet, "/api/auth/star", nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)

		resp := w.Result()
		require.Equal(t, http.StatusTemporaryRedirect, resp.StatusCode)

		loc := resp.Header.Get("Location")
		require.Contains(t, loc, "https://github.com/login/oauth/authorize")
		require.Contains(t, loc, "client_id=Iv1.star-client-id")
		require.Contains(t, loc, "scope=public_repo")
		require.Contains(t, loc, "state=")

		// Cookie should be named star_oauth_state (not oauth_state)
		cookies := resp.Cookies()
		require.Len(t, cookies, 1)
		require.Equal(t, "star_oauth_state", cookies[0].Name)
		require.NotEmpty(t, cookies[0].Value)
		require.Contains(t, loc, "state="+cookies[0].Value)
	})

	t.Run("MissingOAuthClientIDReturns500", func(t *testing.T) {
		cfg := newStarTestConfig("")
		cfg.OAuthClientID = ""
		h := api.Handler(cfg)
		req := httptest.NewRequest(http.MethodGet, "/api/auth/star", nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusInternalServerError, w.Result().StatusCode)
	})
}

func TestAuthStarCallback(t *testing.T) {
	t.Run("ExchangesCodeAndReturnsHTMLWithPostMessage", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var body map[string]string
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			// Should use classic OAuth client ID, not GitHub App client ID
			require.Equal(t, "Iv1.star-client-id", body["client_id"])
			require.Equal(t, "star-secret", body["client_secret"])

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(auth.TokenResponse{
				AccessToken: "gho_classic_token",
				ExpiresIn:   0, // classic tokens don't expire
				TokenType:   "bearer",
			})
		}))
		defer srv.Close()

		h := api.Handler(newStarTestConfig(srv.URL))
		req := httptest.NewRequest(http.MethodGet, "/api/auth/star-callback?code=abc&state=s1", nil)
		req.AddCookie(&http.Cookie{Name: "star_oauth_state", Value: "s1"})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)

		resp := w.Result()
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Contains(t, resp.Header.Get("Content-Type"), "text/html")

		htmlBody, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		html := string(htmlBody)

		// HTML must contain postMessage with the token
		require.Contains(t, html, "ethstar-star-token")
		require.Contains(t, html, "gho_classic_token")
		require.Contains(t, html, "window.opener.postMessage")

		// Token should be JSON-encoded (quoted) inside the JS, not raw
		require.Contains(t, html, `"gho_classic_token"`)

		// Target origin should be the BaseURL, not wildcard '*'
		require.Contains(t, html, "http://localhost:5173")
		require.NotContains(t, html, `}, '*')`)

		// State cookie should be cleared
		var cleared bool
		for _, c := range resp.Cookies() {
			if c.Name == "star_oauth_state" && c.MaxAge < 0 {
				cleared = true
			}
		}
		require.True(t, cleared)
	})

	t.Run("StateMismatchReturns400", func(t *testing.T) {
		h := api.Handler(newStarTestConfig(""))
		req := httptest.NewRequest(http.MethodGet, "/api/auth/star-callback?code=abc&state=s1", nil)
		req.AddCookie(&http.Cookie{Name: "star_oauth_state", Value: "different"})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusBadRequest, w.Result().StatusCode)
	})

	t.Run("MissingCodeReturns400", func(t *testing.T) {
		h := api.Handler(newStarTestConfig(""))
		req := httptest.NewRequest(http.MethodGet, "/api/auth/star-callback?state=s1", nil)
		req.AddCookie(&http.Cookie{Name: "star_oauth_state", Value: "s1"})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusBadRequest, w.Result().StatusCode)
	})

	t.Run("MissingConfigReturns500", func(t *testing.T) {
		cfg := newStarTestConfig("")
		cfg.OAuthClientID = ""
		h := api.Handler(cfg)
		req := httptest.NewRequest(http.MethodGet, "/api/auth/star-callback?code=abc&state=s1", nil)
		req.AddCookie(&http.Cookie{Name: "star_oauth_state", Value: "s1"})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusInternalServerError, w.Result().StatusCode)
	})

	t.Run("TokenExchangeFailureReturnsErrorHTML", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":             "bad_verification_code",
				"error_description": "The code is invalid.",
			})
		}))
		defer srv.Close()

		h := api.Handler(newStarTestConfig(srv.URL))
		req := httptest.NewRequest(http.MethodGet, "/api/auth/star-callback?code=bad&state=s1", nil)
		req.AddCookie(&http.Cookie{Name: "star_oauth_state", Value: "s1"})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)

		resp := w.Result()
		require.Equal(t, http.StatusOK, resp.StatusCode) // still 200 — error shown in HTML

		htmlBody, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		html := string(htmlBody)
		require.Contains(t, html, "Authorization failed")
		// Must NOT contain postMessage with token on error
		require.NotContains(t, html, "ethstar-star-token")
	})
}

// Ensure that adding star routes didn't break existing routes.
func TestExistingRoutesUnaffected(t *testing.T) {
	h := api.Handler(newStarTestConfig(""))
	tests := []struct {
		name   string
		method string
		path   string
		status int
	}{
		{"Health", http.MethodGet, "/api/health", http.StatusOK},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(test.method, test.path, nil)
			w := httptest.NewRecorder()
			h.ServeHTTP(w, req)
			require.Equal(t, test.status, w.Result().StatusCode)
		})
	}
}
