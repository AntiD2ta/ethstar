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

// Package auth provides shared OAuth logic for GitHub App authentication.
package auth

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// GitHubTokenURL is the default GitHub OAuth token endpoint.
const GitHubTokenURL = "https://github.com/login/oauth/access_token" // #nosec G101 -- not a credential

// TokenResponse represents the response from GitHub's OAuth token endpoint.
type TokenResponse struct {
	AccessToken  string `json:"access_token"`  // #nosec G117 -- deserialized from GitHub, not a hardcoded secret
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"` // #nosec G117 -- deserialized from GitHub, not a hardcoded secret
	TokenType    string `json:"token_type"`
}

// githubResponse combines token and error fields since GitHub returns 200 for both.
type githubResponse struct {
	TokenResponse
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

// GenerateState creates a cryptographically random hex-encoded state string.
func GenerateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generating state: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// BuildAuthURL constructs the GitHub App OAuth authorization URL.
// Uses the standard OAuth authorize endpoint with the app's client_id so that
// returning users (who already installed the app) get a seamless re-auth flow
// instead of being redirected to the installation settings page.
func BuildAuthURL(clientID, state string) string {
	v := url.Values{}
	v.Set("client_id", clientID)
	v.Set("state", state)
	return fmt.Sprintf("https://github.com/login/oauth/authorize?%s", v.Encode())
}

// SetNamedStateCookie writes a short-lived, HttpOnly cookie for CSRF state
// validation with the given cookie name. Use different names for different
// OAuth flows (e.g. "oauth_state" for GitHub App, "star_oauth_state" for
// classic OAuth starring).
func SetNamedStateCookie(w http.ResponseWriter, name, state string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    state,
		Path:     "/",
		MaxAge:   600, // 10 minutes
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
	})
}

// SetStateCookie writes a short-lived, HttpOnly cookie for CSRF state validation.
// Pass secure=true in production (HTTPS). Pass secure=false for plaintext
// localhost development — browsers reject Secure cookies over http://.
func SetStateCookie(w http.ResponseWriter, state string, secure bool) {
	SetNamedStateCookie(w, "oauth_state", state, secure)
}

// ClearNamedStateCookie deletes the named cookie. The secure flag must match
// the one used when setting the cookie so the browser recognises and replaces it.
func ClearNamedStateCookie(w http.ResponseWriter, name string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
	})
}

// ClearStateCookie deletes the oauth_state cookie. The secure flag must match
// the one used when setting the cookie so the browser recognises and replaces it.
func ClearStateCookie(w http.ResponseWriter, secure bool) {
	ClearNamedStateCookie(w, "oauth_state", secure)
}

// ValidateNamedState checks that the URL state parameter matches the named cookie.
func ValidateNamedState(r *http.Request, cookieName string) error {
	urlState := r.URL.Query().Get("state")
	if urlState == "" {
		return errors.New("missing state parameter")
	}

	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return errors.New("missing state cookie")
	}

	if urlState != cookie.Value {
		return errors.New("state mismatch")
	}

	return nil
}

// ValidateState checks that the URL state parameter matches the oauth_state cookie.
func ValidateState(r *http.Request) error {
	return ValidateNamedState(r, "oauth_state")
}

// BuildClassicOAuthURL constructs a standard GitHub OAuth authorization URL
// for classic OAuth apps (not GitHub Apps). Used for the starring flow which
// requires the public_repo scope that only classic OAuth tokens provide.
func BuildClassicOAuthURL(clientID, state, scope string) string {
	v := url.Values{}
	v.Set("client_id", clientID)
	v.Set("state", state)
	v.Set("scope", scope)
	return fmt.Sprintf("https://github.com/login/oauth/authorize?%s", v.Encode())
}

// ValidateBaseURL checks that baseURL has a valid scheme (http or https) and a
// non-empty host. Call at startup (dev server) or per-request (serverless) to
// catch misconfiguration before constructing OAuth redirect URLs.
func ValidateBaseURL(baseURL string) error {
	if baseURL == "" {
		return errors.New("BASE_URL is empty")
	}
	u, err := url.Parse(baseURL)
	if err != nil {
		return fmt.Errorf("BASE_URL is not a valid URL: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("BASE_URL has invalid scheme %q: must be http or https", u.Scheme)
	}
	if u.Host == "" {
		return fmt.Errorf("BASE_URL has no host")
	}
	return nil
}

// ValidateBaseURLHost performs the same checks as ValidateBaseURL and
// additionally verifies that the parsed host is in the allowedHosts list.
// Entries may be exact hosts (e.g. "ethstar.org", "localhost:5173") or
// wildcard subdomains (e.g. "*.vercel.app"). An empty or nil allowlist
// skips the host check (permissive, for backward compatibility).
func ValidateBaseURLHost(baseURL string, allowedHosts []string) error {
	if err := ValidateBaseURL(baseURL); err != nil {
		return err
	}

	if len(allowedHosts) == 0 {
		return nil
	}

	u, _ := url.Parse(baseURL) // already validated above
	host := u.Host

	for _, allowed := range allowedHosts {
		if allowed == host {
			return nil
		}
		// Wildcard subdomain: "*.vercel.app" matches any subdomain (including
		// multi-level like "a.b.vercel.app") but not "vercel.app" itself.
		if len(allowed) > 2 && allowed[0] == '*' && allowed[1] == '.' {
			suffix := allowed[1:] // ".vercel.app"
			if strings.HasSuffix(host, suffix) && len(host) > len(suffix) {
				return nil
			}
		}
	}

	return fmt.Errorf("BASE_URL host %q is not in the allowed hosts list", host)
}

// ExchangeCode exchanges an authorization code for an access token.
// tokenURL allows overriding the GitHub endpoint for testing; callers always pass GitHubTokenURL in production.
func ExchangeCode(ctx context.Context, tokenURL, clientID, clientSecret, code string) (TokenResponse, error) {
	body, err := json.Marshal(map[string]string{
		"client_id":     clientID,
		"client_secret": clientSecret,
		"code":          code,
	})
	if err != nil {
		return TokenResponse{}, fmt.Errorf("marshaling request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, bytes.NewReader(body))
	if err != nil {
		return TokenResponse{}, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req) // #nosec G704 -- tokenURL is always GitHubTokenURL or test server
	if err != nil {
		return TokenResponse{}, fmt.Errorf("token exchange request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return TokenResponse{}, fmt.Errorf("token exchange: HTTP %d", resp.StatusCode)
	}

	var ghResp githubResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&ghResp); err != nil {
		return TokenResponse{}, fmt.Errorf("decoding token response: %w", err)
	}
	_, _ = io.Copy(io.Discard, resp.Body) // drain for HTTP/1.1 connection reuse

	if ghResp.Error != "" {
		return TokenResponse{}, fmt.Errorf("token exchange: %s: %s", ghResp.Error, ghResp.ErrorDescription)
	}

	return ghResp.TokenResponse, nil
}

// RefreshToken exchanges a refresh token for a new access token.
// tokenURL allows overriding the GitHub endpoint for testing; callers always pass GitHubTokenURL in production.
func RefreshToken(ctx context.Context, tokenURL, clientID, clientSecret, refreshToken string) (TokenResponse, error) {
	body, err := json.Marshal(map[string]string{
		"client_id":     clientID,
		"client_secret": clientSecret,
		"grant_type":    "refresh_token",
		"refresh_token": refreshToken,
	})
	if err != nil {
		return TokenResponse{}, fmt.Errorf("marshaling request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, bytes.NewReader(body))
	if err != nil {
		return TokenResponse{}, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req) // #nosec G704 -- tokenURL is always GitHubTokenURL or test server
	if err != nil {
		return TokenResponse{}, fmt.Errorf("refresh request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return TokenResponse{}, fmt.Errorf("refresh: HTTP %d", resp.StatusCode)
	}

	var ghResp githubResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&ghResp); err != nil {
		return TokenResponse{}, fmt.Errorf("decoding refresh response: %w", err)
	}
	_, _ = io.Copy(io.Discard, resp.Body) // drain for HTTP/1.1 connection reuse

	if ghResp.Error != "" {
		return TokenResponse{}, fmt.Errorf("refresh: %s: %s", ghResp.Error, ghResp.ErrorDescription)
	}

	return ghResp.TokenResponse, nil
}
