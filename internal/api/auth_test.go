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
	"strings"
	"testing"

	"ethstar/internal/api"
	"ethstar/internal/auth"

	"github.com/stretchr/testify/require"
)

func newTestConfig(tokenURL string) api.Config {
	return api.Config{
		GitHubClientID:     "test-client-id",
		GitHubClientSecret: "test-secret",
		BaseURL:            "http://localhost:5173",
		CookieSecure:       false,
		TokenURL:           tokenURL,
	}
}

func TestAuthGitHubRedirect(t *testing.T) {
	t.Run("RedirectsToGitHubOAuthWithStateCookie", func(t *testing.T) {
		h := api.Handler(newTestConfig(""))
		req := httptest.NewRequest(http.MethodGet, "/api/auth/github", nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)

		resp := w.Result()
		require.Equal(t, http.StatusTemporaryRedirect, resp.StatusCode)

		loc := resp.Header.Get("Location")
		require.Contains(t, loc, "https://github.com/login/oauth/authorize")
		require.Contains(t, loc, "client_id=test-client-id")
		require.Contains(t, loc, "state=")

		cookies := resp.Cookies()
		require.Len(t, cookies, 1)
		require.Equal(t, "oauth_state", cookies[0].Name)
		require.NotEmpty(t, cookies[0].Value)
		require.False(t, cookies[0].Secure)
		require.Contains(t, loc, "state="+cookies[0].Value)
	})

	t.Run("MissingClientIDReturns500", func(t *testing.T) {
		cfg := newTestConfig("")
		cfg.GitHubClientID = ""
		h := api.Handler(cfg)
		req := httptest.NewRequest(http.MethodGet, "/api/auth/github", nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusInternalServerError, w.Result().StatusCode)
	})
}

func TestAuthCallback(t *testing.T) {
	t.Run("ExchangesCodeAndRedirectsWithFragment", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(auth.TokenResponse{
				AccessToken:  "ghu_abc",
				ExpiresIn:    28800,
				RefreshToken: "ghr_xyz",
				TokenType:    "bearer",
			})
		}))
		defer srv.Close()

		h := api.Handler(newTestConfig(srv.URL))
		req := httptest.NewRequest(http.MethodGet, "/api/auth/callback?code=abc&state=s1", nil)
		req.AddCookie(&http.Cookie{Name: "oauth_state", Value: "s1"})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)

		resp := w.Result()
		require.Equal(t, http.StatusTemporaryRedirect, resp.StatusCode)

		loc := resp.Header.Get("Location")
		require.True(t, strings.HasPrefix(loc, "http://localhost:5173/#"), "got: %s", loc)
		require.Contains(t, loc, "access_token=ghu_abc")
		require.Contains(t, loc, "expires_in=28800")
		require.Contains(t, loc, "refresh_token=ghr_xyz")

		// State cookie should be cleared.
		var cleared bool
		for _, c := range resp.Cookies() {
			if c.Name == "oauth_state" && c.MaxAge < 0 {
				cleared = true
			}
		}
		require.True(t, cleared)
	})

	t.Run("StateMismatchReturns400", func(t *testing.T) {
		h := api.Handler(newTestConfig(""))
		req := httptest.NewRequest(http.MethodGet, "/api/auth/callback?code=abc&state=s1", nil)
		req.AddCookie(&http.Cookie{Name: "oauth_state", Value: "different"})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusBadRequest, w.Result().StatusCode)
	})

	t.Run("MissingCodeReturns400", func(t *testing.T) {
		h := api.Handler(newTestConfig(""))
		req := httptest.NewRequest(http.MethodGet, "/api/auth/callback?state=s1", nil)
		req.AddCookie(&http.Cookie{Name: "oauth_state", Value: "s1"})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusBadRequest, w.Result().StatusCode)
	})

	t.Run("MissingBaseURLReturns500", func(t *testing.T) {
		cfg := newTestConfig("")
		cfg.BaseURL = ""
		h := api.Handler(cfg)
		req := httptest.NewRequest(http.MethodGet, "/api/auth/callback?code=abc&state=s1", nil)
		req.AddCookie(&http.Cookie{Name: "oauth_state", Value: "s1"})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusInternalServerError, w.Result().StatusCode)
	})
}

func TestAuthRefresh(t *testing.T) {
	t.Run("ReturnsNewToken", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(auth.TokenResponse{
				AccessToken:  "ghu_new",
				ExpiresIn:    28800,
				RefreshToken: "ghr_new",
				TokenType:    "bearer",
			})
		}))
		defer srv.Close()

		h := api.Handler(newTestConfig(srv.URL))
		body := strings.NewReader(`{"refresh_token":"ghr_old"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)

		resp := w.Result()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var tr auth.TokenResponse
		require.NoError(t, json.Unmarshal(b, &tr))
		require.Equal(t, "ghu_new", tr.AccessToken)
		require.Equal(t, "ghr_new", tr.RefreshToken)
	})

	t.Run("MissingRefreshTokenReturns400", func(t *testing.T) {
		h := api.Handler(newTestConfig(""))
		body := strings.NewReader(`{}`)
		req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusBadRequest, w.Result().StatusCode)
	})

	t.Run("InvalidJSONReturns400", func(t *testing.T) {
		h := api.Handler(newTestConfig(""))
		body := strings.NewReader(`not-json`)
		req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusBadRequest, w.Result().StatusCode)
	})

	t.Run("WrongMethodReturns405", func(t *testing.T) {
		h := api.Handler(newTestConfig(""))
		req := httptest.NewRequest(http.MethodGet, "/api/auth/refresh", nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusMethodNotAllowed, w.Result().StatusCode)
	})
}

func TestHandlerHealthStillWorks(t *testing.T) {
	t.Run("HealthEndpoint", func(t *testing.T) {
		h := api.Handler(newTestConfig(""))
		req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		require.Equal(t, http.StatusOK, w.Result().StatusCode)
	})
}
