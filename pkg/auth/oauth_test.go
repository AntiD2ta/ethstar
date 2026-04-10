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

package auth_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"ethstar/pkg/auth"

	"github.com/stretchr/testify/require"
)

func TestGenerateState(t *testing.T) {
	t.Run("ReturnsNonEmpty", func(t *testing.T) {
		state, err := auth.GenerateState()
		require.NoError(t, err)
		require.NotEmpty(t, state)
		// 16 bytes hex-encoded = 32 chars
		require.Len(t, state, 32)
	})

	t.Run("ReturnsDifferentValues", func(t *testing.T) {
		s1, err := auth.GenerateState()
		require.NoError(t, err)
		s2, err := auth.GenerateState()
		require.NoError(t, err)
		require.NotEqual(t, s1, s2)
	})
}

func TestBuildAuthURL(t *testing.T) {
	tests := []struct {
		name     string
		clientID string
		state    string
		contains []string
	}{
		{
			name:     "UsesOAuthAuthorizeURL",
			clientID: "Iv1.abc123",
			state:    "abc123",
			contains: []string{
				"https://github.com/login/oauth/authorize",
				"client_id=Iv1.abc123",
				"state=abc123",
			},
		},
		{
			name:     "EncodesSpecialChars",
			clientID: "Iv1.xyz",
			state:    "state+with/special",
			contains: []string{
				"https://github.com/login/oauth/authorize",
				"client_id=Iv1.xyz",
				"state=state",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			u := auth.BuildAuthURL(test.clientID, test.state)
			for _, s := range test.contains {
				require.Contains(t, u, s)
			}
		})
	}
}

func TestSetStateCookie(t *testing.T) {
	t.Run("SetsCookieWithCorrectAttributes", func(t *testing.T) {
		w := httptest.NewRecorder()
		auth.SetStateCookie(w, "test-state", true)

		cookies := w.Result().Cookies()
		require.Len(t, cookies, 1)

		c := cookies[0]
		require.Equal(t, "oauth_state", c.Name)
		require.Equal(t, "test-state", c.Value)
		require.True(t, c.HttpOnly)
		require.Equal(t, http.SameSiteLaxMode, c.SameSite)
		require.Equal(t, "/", c.Path)
		require.Greater(t, c.MaxAge, 0)
	})
}

func TestClearStateCookie(t *testing.T) {
	t.Run("SetsCookieWithNegativeMaxAge", func(t *testing.T) {
		w := httptest.NewRecorder()
		auth.ClearStateCookie(w, true)

		cookies := w.Result().Cookies()
		require.Len(t, cookies, 1)
		require.Equal(t, "oauth_state", cookies[0].Name)
		require.Equal(t, -1, cookies[0].MaxAge)
	})
}

func TestValidateState(t *testing.T) {
	tests := []struct {
		name       string
		urlState   string
		cookieVal  string
		hasCookie  bool
		err        string
	}{
		{
			name:      "Valid",
			urlState:  "abc123",
			cookieVal: "abc123",
			hasCookie: true,
		},
		{
			name:      "MissingCookie",
			urlState:  "abc123",
			hasCookie: false,
			err:       "missing state cookie",
		},
		{
			name:      "Mismatch",
			urlState:  "abc123",
			cookieVal: "xyz789",
			hasCookie: true,
			err:       "state mismatch",
		},
		{
			name:      "EmptyURLState",
			urlState:  "",
			cookieVal: "abc123",
			hasCookie: true,
			err:       "missing state parameter",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/?state="+test.urlState, nil)
			if test.hasCookie {
				req.AddCookie(&http.Cookie{Name: "oauth_state", Value: test.cookieVal})
			}

			err := auth.ValidateState(req)
			if test.err != "" {
				require.EqualError(t, err, test.err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestExchangeCode(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)
			require.Equal(t, "application/json", r.Header.Get("Accept"))

			var body map[string]string
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			require.Equal(t, "test-client-id", body["client_id"])
			require.Equal(t, "test-secret", body["client_secret"])
			require.Equal(t, "test-code", body["code"])

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(auth.TokenResponse{
				AccessToken:  "ghu_abc123",
				ExpiresIn:    28800,
				RefreshToken: "ghr_xyz789",
				TokenType:    "bearer",
			})
		}))
		defer srv.Close()

		resp, err := auth.ExchangeCode(context.Background(), srv.URL, "test-client-id", "test-secret", "test-code")
		require.NoError(t, err)
		require.Equal(t, "ghu_abc123", resp.AccessToken)
		require.Equal(t, 28800, resp.ExpiresIn)
		require.Equal(t, "ghr_xyz789", resp.RefreshToken)
		require.Equal(t, "bearer", resp.TokenType)
	})

	t.Run("GitHubReturnsError", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":             "bad_verification_code",
				"error_description": "The code passed is incorrect or expired.",
			})
		}))
		defer srv.Close()

		_, err := auth.ExchangeCode(context.Background(), srv.URL, "id", "secret", "bad-code")
		require.ErrorContains(t, err, "bad_verification_code")
	})

	t.Run("HTTPError", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer srv.Close()

		_, err := auth.ExchangeCode(context.Background(), srv.URL, "id", "secret", "code")
		require.Error(t, err)
	})
}

func TestValidateBaseURL(t *testing.T) {
	tests := []struct {
		name    string
		baseURL string
		err     string
	}{
		{
			name:    "ValidHTTPS",
			baseURL: "https://ethstar.org",
		},
		{
			name:    "ValidHTTP",
			baseURL: "http://localhost:5173",
		},
		{
			name:    "Empty",
			baseURL: "",
			err:     "BASE_URL is empty",
		},
		{
			name:    "InvalidScheme",
			baseURL: "ftp://ethstar.org",
			err:     "BASE_URL has invalid scheme \"ftp\": must be http or https",
		},
		{
			name:    "MissingScheme",
			baseURL: "ethstar.org",
			err:     "BASE_URL has invalid scheme \"\": must be http or https",
		},
		{
			name:    "MissingHost",
			baseURL: "http://",
			err:     "BASE_URL has no host",
		},
		{
			name:    "WithPath",
			baseURL: "https://ethstar.org/app",
		},
		{
			name:    "TrailingSlash",
			baseURL: "https://ethstar.org/",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := auth.ValidateBaseURL(test.baseURL)
			if test.err != "" {
				require.EqualError(t, err, test.err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestValidateBaseURLHost(t *testing.T) {
	tests := []struct {
		name         string
		baseURL      string
		allowedHosts []string
		err          string
	}{
		{
			name:         "ExactMatch",
			baseURL:      "https://ethstar.org",
			allowedHosts: []string{"ethstar.org"},
		},
		{
			name:         "ExactMatchWithPort",
			baseURL:      "http://localhost:5173",
			allowedHosts: []string{"localhost:5173"},
		},
		{
			name:         "WildcardSubdomain",
			baseURL:      "https://my-deploy-abc123.vercel.app",
			allowedHosts: []string{"*.vercel.app"},
		},
		{
			name:         "WildcardDoesNotMatchExact",
			baseURL:      "https://vercel.app",
			allowedHosts: []string{"*.vercel.app"},
			err:          `BASE_URL host "vercel.app" is not in the allowed hosts list`,
		},
		{
			name:         "HostNotInList",
			baseURL:      "https://evil.example.com",
			allowedHosts: []string{"ethstar.org", "localhost:5173"},
			err:          `BASE_URL host "evil.example.com" is not in the allowed hosts list`,
		},
		{
			name:         "EmptyAllowlist",
			baseURL:      "https://anything.example.com",
			allowedHosts: []string{},
		},
		{
			name:         "NilAllowlist",
			baseURL:      "https://anything.example.com",
			allowedHosts: nil,
		},
		{
			name:         "InvalidBaseURL",
			baseURL:      "",
			allowedHosts: []string{"ethstar.org"},
			err:          "BASE_URL is empty",
		},
		{
			name:         "MultipleAllowedHosts",
			baseURL:      "http://localhost:8080",
			allowedHosts: []string{"ethstar.org", "localhost:5173", "localhost:8080", "*.vercel.app"},
		},
		{
			name:         "MultiLabelWildcard",
			baseURL:      "https://deeply.nested.vercel.app",
			allowedHosts: []string{"*.vercel.app"},
		},
		{
			name:         "WhitespaceInAllowedHost",
			baseURL:      "https://ethstar.org",
			allowedHosts: []string{" ethstar.org "},
			err:          `BASE_URL host "ethstar.org" is not in the allowed hosts list`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := auth.ValidateBaseURLHost(test.baseURL, test.allowedHosts)
			if test.err != "" {
				require.EqualError(t, err, test.err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestSetNamedStateCookie(t *testing.T) {
	tests := []struct {
		name       string
		cookieName string
		state      string
		secure     bool
	}{
		{
			name:       "StarOAuthState",
			cookieName: "star_oauth_state",
			state:      "test-star-state",
			secure:     true,
		},
		{
			name:       "CustomName",
			cookieName: "custom_state",
			state:      "custom-val",
			secure:     false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			auth.SetNamedStateCookie(w, test.cookieName, test.state, test.secure)

			cookies := w.Result().Cookies()
			require.Len(t, cookies, 1)

			c := cookies[0]
			require.Equal(t, test.cookieName, c.Name)
			require.Equal(t, test.state, c.Value)
			require.True(t, c.HttpOnly)
			require.Equal(t, http.SameSiteLaxMode, c.SameSite)
			require.Equal(t, "/", c.Path)
			require.Greater(t, c.MaxAge, 0)
			require.Equal(t, test.secure, c.Secure)
		})
	}
}

func TestClearNamedStateCookie(t *testing.T) {
	t.Run("ClearsNamedCookie", func(t *testing.T) {
		w := httptest.NewRecorder()
		auth.ClearNamedStateCookie(w, "star_oauth_state", true)

		cookies := w.Result().Cookies()
		require.Len(t, cookies, 1)
		require.Equal(t, "star_oauth_state", cookies[0].Name)
		require.Equal(t, -1, cookies[0].MaxAge)
	})
}

func TestValidateNamedState(t *testing.T) {
	tests := []struct {
		name       string
		cookieName string
		urlState   string
		cookieVal  string
		hasCookie  bool
		err        string
	}{
		{
			name:       "Valid",
			cookieName: "star_oauth_state",
			urlState:   "abc123",
			cookieVal:  "abc123",
			hasCookie:  true,
		},
		{
			name:       "MissingCookie",
			cookieName: "star_oauth_state",
			urlState:   "abc123",
			hasCookie:  false,
			err:        "missing state cookie",
		},
		{
			name:       "Mismatch",
			cookieName: "star_oauth_state",
			urlState:   "abc123",
			cookieVal:  "xyz789",
			hasCookie:  true,
			err:        "state mismatch",
		},
		{
			name:       "EmptyURLState",
			cookieName: "star_oauth_state",
			urlState:   "",
			cookieVal:  "abc123",
			hasCookie:  true,
			err:        "missing state parameter",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/?state="+test.urlState, nil)
			if test.hasCookie {
				req.AddCookie(&http.Cookie{Name: test.cookieName, Value: test.cookieVal})
			}

			err := auth.ValidateNamedState(req, test.cookieName)
			if test.err != "" {
				require.EqualError(t, err, test.err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestBuildClassicOAuthURL(t *testing.T) {
	tests := []struct {
		name     string
		clientID string
		state    string
		scope    string
		contains []string
	}{
		{
			name:     "PublicRepoScope",
			clientID: "Iv1.abc123",
			state:    "state-xyz",
			scope:    "public_repo",
			contains: []string{
				"https://github.com/login/oauth/authorize",
				"client_id=Iv1.abc123",
				"state=state-xyz",
				"scope=public_repo",
			},
		},
		{
			name:     "EncodesSpecialChars",
			clientID: "my+id",
			state:    "state/special",
			scope:    "public_repo",
			contains: []string{
				"client_id=my%2Bid",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			u := auth.BuildClassicOAuthURL(test.clientID, test.state, test.scope)
			for _, s := range test.contains {
				require.Contains(t, u, s)
			}
		})
	}
}

func TestRefreshToken(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)

			var body map[string]string
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			require.Equal(t, "refresh_token", body["grant_type"])
			require.Equal(t, "test-client-id", body["client_id"])
			require.Equal(t, "test-secret", body["client_secret"])
			require.Equal(t, "ghr_old", body["refresh_token"])

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(auth.TokenResponse{
				AccessToken:  "ghu_new",
				ExpiresIn:    28800,
				RefreshToken: "ghr_new",
				TokenType:    "bearer",
			})
		}))
		defer srv.Close()

		resp, err := auth.RefreshToken(context.Background(), srv.URL, "test-client-id", "test-secret", "ghr_old")
		require.NoError(t, err)
		require.Equal(t, "ghu_new", resp.AccessToken)
		require.Equal(t, "ghr_new", resp.RefreshToken)
	})

	t.Run("GitHubReturnsError", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":             "bad_refresh_token",
				"error_description": "The refresh token is invalid.",
			})
		}))
		defer srv.Close()

		_, err := auth.RefreshToken(context.Background(), srv.URL, "id", "secret", "bad")
		require.ErrorContains(t, err, "bad_refresh_token")
	})
}
