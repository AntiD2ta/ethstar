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

package stats

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestVerifyGitHubToken(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		err        string
	}{
		{
			name:       "ValidToken",
			statusCode: http.StatusOK,
		},
		{
			name:       "InvalidToken",
			statusCode: http.StatusUnauthorized,
			err:        "GitHub token verification failed: HTTP 401",
		},
		{
			name:       "Forbidden",
			statusCode: http.StatusForbidden,
			err:        "GitHub token verification failed: HTTP 403",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, "Bearer test-token", r.Header.Get("Authorization"))
				w.WriteHeader(test.statusCode)
			}))
			defer srv.Close()

			err := verifyGitHubToken(t.Context(), "test-token", srv.URL)
			if test.err != "" {
				require.EqualError(t, err, test.err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestVerifyGitHubTokenCached(t *testing.T) {
	t.Run("CacheHitSkipsGitHub", func(t *testing.T) {
		// KV server: EXISTS returns 1 (cached)
		kvSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Contains(t, r.URL.Path, "/exists/")
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"result":1}`))
		}))
		defer kvSrv.Close()

		// GitHub server: should NOT be called
		var ghCalls atomic.Int32
		ghSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			ghCalls.Add(1)
			w.WriteHeader(http.StatusOK)
		}))
		defer ghSrv.Close()

		err := verifyGitHubTokenCached(t.Context(), "test-token", ghSrv.URL, kvSrv.URL, "kv-token")
		require.NoError(t, err)
		require.Equal(t, int32(0), ghCalls.Load(), "GitHub should not be called when token is cached")
	})

	t.Run("CacheMissVerifiesAndCaches", func(t *testing.T) {
		var kvPaths []string
		kvSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			kvPaths = append(kvPaths, r.Method+" "+r.URL.Path)
			w.Header().Set("Content-Type", "application/json")
			if r.Method == http.MethodGet {
				// EXISTS returns 0 (not cached)
				_, _ = w.Write([]byte(`{"result":0}`))
			} else {
				// SET returns OK
				_, _ = w.Write([]byte(`{"result":"OK"}`))
			}
		}))
		defer kvSrv.Close()

		ghSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ghSrv.Close()

		err := verifyGitHubTokenCached(t.Context(), "test-token", ghSrv.URL, kvSrv.URL, "kv-token")
		require.NoError(t, err)

		// Should have called EXISTS then SET
		require.Len(t, kvPaths, 2)
		require.Contains(t, kvPaths[0], "GET /exists/")
		require.Contains(t, kvPaths[1], "POST /")
	})

	t.Run("InvalidTokenNotCached", func(t *testing.T) {
		var kvCalls atomic.Int32
		kvSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			kvCalls.Add(1)
			w.Header().Set("Content-Type", "application/json")
			if r.Method == http.MethodGet {
				_, _ = w.Write([]byte(`{"result":0}`))
			}
		}))
		defer kvSrv.Close()

		ghSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		}))
		defer ghSrv.Close()

		err := verifyGitHubTokenCached(t.Context(), "bad-token", ghSrv.URL, kvSrv.URL, "kv-token")
		require.Error(t, err)
		// Only EXISTS call, no SET
		require.Equal(t, int32(1), kvCalls.Load(), "invalid token should not be cached")
	})

	t.Run("KVErrorFallsBackToGitHub", func(t *testing.T) {
		// KV server returns 500 — should fall back to GitHub verification.
		kvSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer kvSrv.Close()

		ghSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ghSrv.Close()

		err := verifyGitHubTokenCached(t.Context(), "test-token", ghSrv.URL, kvSrv.URL, "kv-token")
		require.NoError(t, err, "KV error should fall back to GitHub, not reject the request")
	})

	t.Run("KVUnavailableFallsBackToGitHub", func(t *testing.T) {
		// Pass empty KV URL — should skip cache entirely
		ghSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ghSrv.Close()

		err := verifyGitHubTokenCached(t.Context(), "test-token", ghSrv.URL, "", "")
		require.NoError(t, err)
	})
}

func TestHandlePostAuth(t *testing.T) {
	t.Run("MissingKVReturns503", func(t *testing.T) {
		// Without KV env vars, POST returns 503 before auth check.
		body := strings.NewReader(`{"stars":5}`)
		req := httptest.NewRequest(http.MethodPost, "/api/stats", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handlePost(w, req)
		require.Equal(t, http.StatusServiceUnavailable, w.Result().StatusCode)
	})

	t.Run("MissingAuthReturns401", func(t *testing.T) {
		// Set KV env vars so we reach the auth check.
		t.Setenv("KV_REST_API_URL", "http://fake-kv")
		t.Setenv("KV_REST_API_TOKEN", "fake-token")

		body := strings.NewReader(`{"stars":5}`)
		req := httptest.NewRequest(http.MethodPost, "/api/stats", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handlePost(w, req)
		require.Equal(t, http.StatusUnauthorized, w.Result().StatusCode)
	})

	t.Run("InvalidTokenReturns401", func(t *testing.T) {
		ghSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		}))
		defer ghSrv.Close()

		// Set KV env vars so we reach the auth check.
		t.Setenv("KV_REST_API_URL", "http://fake-kv")
		t.Setenv("KV_REST_API_TOKEN", "fake-token")

		// Override the GitHub user URL for this test.
		origURL := gitHubUserURL
		gitHubUserURL = ghSrv.URL
		defer func() { gitHubUserURL = origURL }()

		body := strings.NewReader(`{"stars":5}`)
		req := httptest.NewRequest(http.MethodPost, "/api/stats", body)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer bad-token")
		w := httptest.NewRecorder()
		handlePost(w, req)
		require.Equal(t, http.StatusUnauthorized, w.Result().StatusCode)
	})
}

func TestKVPipeline(t *testing.T) {
	t.Run("SendsBothIncrCommands", func(t *testing.T) {
		var receivedBody [][]any
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)
			require.Equal(t, "/pipeline", r.URL.Path)
			require.Equal(t, "Bearer test-kv-token", r.Header.Get("Authorization"))

			err := json.NewDecoder(r.Body).Decode(&receivedBody)
			require.NoError(t, err)

			w.Header().Set("Content-Type", "application/json")
			// Vercel KV pipeline returns an array of results.
			_, _ = w.Write([]byte(`[{"result":105},{"result":8}]`))
		}))
		defer srv.Close()

		err := kvPipelineIncr(t.Context(), srv.URL, "test-kv-token", "total_stars", 5, "total_users", 1)
		require.NoError(t, err)

		require.Len(t, receivedBody, 2)
		require.Equal(t, []any{"INCRBY", "total_stars", float64(5)}, receivedBody[0])
		require.Equal(t, []any{"INCRBY", "total_users", float64(1)}, receivedBody[1])
	})

	t.Run("ReturnsErrorOnPerCommandError", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			// Vercel KV returns per-command error objects when a command fails.
			_, _ = w.Write([]byte(`[{"result":105},{"error":"WRONGTYPE Operation against a key holding the wrong kind of value"}]`))
		}))
		defer srv.Close()

		err := kvPipelineIncr(t.Context(), srv.URL, "test-kv-token", "total_stars", 5, "total_users", 1)
		require.ErrorContains(t, err, "WRONGTYPE")
	})

	t.Run("ReturnsErrorOnNon200", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer srv.Close()

		err := kvPipelineIncr(t.Context(), srv.URL, "token", "k1", 1, "k2", 1)
		require.ErrorContains(t, err, "KV pipeline: HTTP 500")
	})
}

func TestKVSetEx(t *testing.T) {
	t.Run("SendsSetExCommand", func(t *testing.T) {
		var receivedBody []any
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)
			require.Equal(t, "/", r.URL.Path)
			require.Equal(t, "Bearer kv-token", r.Header.Get("Authorization"))

			err := json.NewDecoder(r.Body).Decode(&receivedBody)
			require.NoError(t, err)

			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"result":"OK"}`))
		}))
		defer srv.Close()

		err := kvSetEx(t.Context(), srv.URL, "kv-token", "tok:abc123", "1", 300)
		require.NoError(t, err)

		require.Len(t, receivedBody, 5)
		require.Equal(t, "SET", receivedBody[0])
		require.Equal(t, "tok:abc123", receivedBody[1])
		require.Equal(t, "1", receivedBody[2])
		require.Equal(t, "EX", receivedBody[3])
		require.Equal(t, float64(300), receivedBody[4])
	})

	t.Run("ReturnsErrorOnNon200", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer srv.Close()

		err := kvSetEx(t.Context(), srv.URL, "token", "key", "val", 60)
		require.ErrorContains(t, err, "KV SET EX: HTTP 500")
	})
}

func TestKVExists(t *testing.T) {
	t.Run("KeyExists", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodGet, r.Method)
			require.Equal(t, "/exists/my%2Fkey", r.URL.RawPath)

			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"result":1}`))
		}))
		defer srv.Close()

		// Use "/" in key to verify url.PathEscape prevents path traversal.
		exists, err := kvExists(t.Context(), srv.URL, "kv-token", "my/key")
		require.NoError(t, err)
		require.True(t, exists)
	})

	t.Run("KeyDoesNotExist", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"result":0}`))
		}))
		defer srv.Close()

		exists, err := kvExists(t.Context(), srv.URL, "kv-token", "my/key")
		require.NoError(t, err)
		require.False(t, exists)
	})

	t.Run("ReturnsErrorOnNon200", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer srv.Close()

		_, err := kvExists(t.Context(), srv.URL, "token", "key")
		require.ErrorContains(t, err, "KV EXISTS: HTTP 500")
	})
}

func TestExtractBearerToken(t *testing.T) {
	tests := []struct {
		name   string
		header string
		token  string
		err    string
	}{
		{
			name:   "Valid",
			header: "Bearer ghu_abc123",
			token:  "ghu_abc123",
		},
		{
			name:   "Empty",
			header: "",
			err:    "missing Authorization header",
		},
		{
			name:   "WrongScheme",
			header: "Basic abc123",
			err:    "authorization header must use Bearer scheme",
		},
		{
			name:   "BearerOnly",
			header: "Bearer ",
			err:    "empty bearer token",
		},
		{
			name:   "BearerNoSpace",
			header: "Bearer",
			err:    "authorization header must use Bearer scheme",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			token, err := extractBearerToken(test.header)
			if test.err != "" {
				require.EqualError(t, err, test.err)
			} else {
				require.NoError(t, err)
				require.Equal(t, test.token, token)
			}
		})
	}
}
