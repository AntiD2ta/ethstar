// Package stats implements the Vercel serverless function for /api/stats.
// GET returns the star counter from Vercel KV.
// POST increments the counter.
package stats

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
)

// gitHubUserURL is the GitHub API endpoint for token verification.
// Tests may reassign this to point at a local httptest server.
var gitHubUserURL = "https://api.github.com/user"

// maxStarsPerRequest is the maximum number of stars a single POST can increment.
const maxStarsPerRequest = 100

// StatsResponse is the JSON shape returned by GET /api/stats.
type StatsResponse struct {
	TotalStars int `json:"total_stars"`
	TotalUsers int `json:"total_users"`
}

type incrementRequest struct {
	Stars int `json:"stars"`
}

// Handler is the Vercel serverless entrypoint.
func Handler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		handleGet(w, r)
	case http.MethodPost:
		handlePost(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleGet(w http.ResponseWriter, r *http.Request) {
	kvURL := os.Getenv("KV_REST_API_URL")
	kvToken := os.Getenv("KV_REST_API_TOKEN")

	if kvURL == "" || kvToken == "" {
		http.Error(w, "stats unavailable", http.StatusServiceUnavailable)
		return
	}

	// Fetch both counters concurrently to halve KV latency.
	var (
		totalStars, totalUsers int
		starsErr, usersErr     error
		wg                     sync.WaitGroup
	)

	wg.Add(2)
	go func() {
		defer wg.Done()
		totalStars, starsErr = kvGet(r.Context(), kvURL, kvToken, "total_stars")
	}()
	go func() {
		defer wg.Done()
		totalUsers, usersErr = kvGet(r.Context(), kvURL, kvToken, "total_users")
	}()
	wg.Wait()

	if starsErr != nil {
		slog.Error("reading total_stars from KV", "error", starsErr) // #nosec G706
		http.Error(w, "stats unavailable", http.StatusServiceUnavailable)
		return
	}
	if usersErr != nil {
		slog.Error("reading total_users from KV", "error", usersErr) // #nosec G706
		http.Error(w, "stats unavailable", http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
	if err := json.NewEncoder(w).Encode(StatsResponse{
		TotalStars: totalStars,
		TotalUsers: totalUsers,
	}); err != nil {
		slog.Error("encoding stats response", "error", err) // #nosec G706
	}
}

func handlePost(w http.ResponseWriter, r *http.Request) {
	kvURL := os.Getenv("KV_REST_API_URL")
	kvToken := os.Getenv("KV_REST_API_TOKEN")

	if kvURL == "" || kvToken == "" {
		http.Error(w, "stats unavailable", http.StatusServiceUnavailable)
		return
	}

	// Verify GitHub token to prevent unauthenticated counter inflation.
	token, err := extractBearerToken(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	// Use cached verification when KV is available (saves ~100-300ms GitHub RTT).
	if err := verifyGitHubTokenCached(r.Context(), token, gitHubUserURL, kvURL, kvToken); err != nil {
		slog.Error("token verification failed", "error", err) // #nosec G706
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(nil, r.Body, 1<<20)
	var req incrementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Stars <= 0 || req.Stars > maxStarsPerRequest {
		http.Error(w, fmt.Sprintf("stars must be between 1 and %d", maxStarsPerRequest), http.StatusBadRequest)
		return
	}

	// Increment both counters atomically in a single KV pipeline request.
	if err := kvPipelineIncr(r.Context(), kvURL, kvToken, "total_stars", req.Stars, "total_users", 1); err != nil {
		slog.Error("incrementing stats", "error", err) // #nosec G706
		http.Error(w, "stats unavailable", http.StatusServiceUnavailable)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// extractBearerToken extracts the token from an Authorization header value.
func extractBearerToken(header string) (string, error) {
	if header == "" {
		return "", errors.New("missing Authorization header")
	}
	token, found := strings.CutPrefix(header, "Bearer ")
	if !found {
		return "", errors.New("authorization header must use Bearer scheme")
	}
	if token == "" {
		return "", errors.New("empty bearer token")
	}
	return token, nil
}

const (
	// tokenCacheTTL is how long a verified token hash stays in KV (5 minutes).
	tokenCacheTTL = 300
	// tokenCachePrefix is the KV key prefix for cached token hashes.
	tokenCachePrefix = "tok:"
)

// hashToken returns a hex-encoded SHA-256 hash of the token.
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// verifyGitHubTokenCached checks the token against a KV cache first.
// On cache miss, it verifies with GitHub and caches the result.
// If KV is unavailable (empty URL/token), it falls back to direct GitHub verification.
func verifyGitHubTokenCached(ctx context.Context, token, userURL, kvURL, kvToken string) error {
	// If KV is not configured, fall back to direct verification.
	if kvURL == "" || kvToken == "" {
		return verifyGitHubToken(ctx, token, userURL)
	}

	cacheKey := tokenCachePrefix + hashToken(token)

	// Check cache first.
	exists, err := kvExists(ctx, kvURL, kvToken, cacheKey)
	if err != nil {
		// KV error is non-fatal — fall back to GitHub verification.
		slog.Error("KV EXISTS check failed, falling back to GitHub", "error", err) // #nosec G706
	} else if exists {
		return nil
	}

	// Cache miss or KV error — verify with GitHub.
	if err := verifyGitHubToken(ctx, token, userURL); err != nil {
		return err
	}

	// Cache the verified token hash. Fire-and-forget: KV write failure is non-fatal.
	if setErr := kvSetEx(ctx, kvURL, kvToken, cacheKey, "1", tokenCacheTTL); setErr != nil {
		slog.Error("caching verified token in KV", "error", setErr) // #nosec G706
	}

	return nil
}

// verifyGitHubToken checks that the given token is valid by calling the GitHub API.
func verifyGitHubToken(ctx context.Context, token, userURL string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, userURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req) // #nosec G704 -- userURL is always gitHubUserURL or test server
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GitHub token verification failed: HTTP %d", resp.StatusCode)
	}
	return nil
}

// kvPipelineIncr sends two INCRBY commands in a single Vercel KV pipeline request.
// This replaces two parallel goroutine calls with one atomic round-trip.
func kvPipelineIncr(ctx context.Context, kvURL, kvToken, key1 string, amount1 int, key2 string, amount2 int) error {
	pipeline := [][]any{
		{"INCRBY", key1, amount1},
		{"INCRBY", key2, amount2},
	}

	body, err := json.Marshal(pipeline)
	if err != nil {
		return fmt.Errorf("marshaling pipeline: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, kvURL+"/pipeline", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+kvToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req) // #nosec G704 -- kvURL is a trusted Vercel KV endpoint
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, resp.Body)
		return fmt.Errorf("KV pipeline: HTTP %d", resp.StatusCode)
	}

	// Decode per-command results to detect individual failures.
	// Vercel KV pipeline response: [{result: N}, {result: N}] on success,
	// or [{error: "..."}, ...] when a command fails.
	var results []struct {
		Error string `json:"error"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&results); err != nil {
		return fmt.Errorf("decoding KV pipeline response: %w", err)
	}
	_, _ = io.Copy(io.Discard, resp.Body)

	var errs []string
	for i, r := range results {
		if r.Error != "" {
			errs = append(errs, fmt.Sprintf("command %d: %s", i, r.Error))
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("KV pipeline errors: %s", strings.Join(errs, "; "))
	}
	return nil
}

// kvSetEx sets a key in Vercel KV with an expiry in seconds.
// Vercel KV REST API: POST {KV_REST_API_URL} with ["SET", key, value, "EX", ttl].
func kvSetEx(ctx context.Context, kvURL, kvToken, key, value string, ttlSeconds int) error {
	cmd := []any{"SET", key, value, "EX", ttlSeconds}
	body, err := json.Marshal(cmd)
	if err != nil {
		return fmt.Errorf("marshaling SET EX: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, kvURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+kvToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req) // #nosec G704 -- kvURL is a trusted Vercel KV endpoint
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("KV SET EX: HTTP %d", resp.StatusCode)
	}
	return nil
}

// kvExists checks if a key exists in Vercel KV.
// Vercel KV REST API: GET {KV_REST_API_URL}/exists/{key}
// Returns true if the key exists (result >= 1).
func kvExists(ctx context.Context, kvURL, kvToken, key string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/exists/%s", kvURL, url.PathEscape(key)), nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("Authorization", "Bearer "+kvToken)

	resp, err := http.DefaultClient.Do(req) // #nosec G704 -- kvURL is a trusted Vercel KV endpoint
	if err != nil {
		return false, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, resp.Body)
		return false, fmt.Errorf("KV EXISTS: HTTP %d", resp.StatusCode)
	}

	var result struct {
		Result int `json:"result"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return false, err
	}
	_, _ = io.Copy(io.Discard, resp.Body)

	return result.Result >= 1, nil
}

// kvGet reads an integer value from Vercel KV.
// Vercel KV REST API: GET {KV_REST_API_URL}/get/{key}
func kvGet(ctx context.Context, kvURL, kvToken, key string) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/get/%s", kvURL, url.PathEscape(key)), nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+kvToken)

	resp, err := http.DefaultClient.Do(req) // #nosec G704 -- kvURL is a trusted Vercel KV endpoint
	if err != nil {
		return 0, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, resp.Body)
		return 0, fmt.Errorf("KV GET %s: HTTP %d", key, resp.StatusCode)
	}

	var result struct {
		Result *string `json:"result"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return 0, err
	}
	// Drain any remaining body bytes to enable HTTP connection reuse.
	_, _ = io.Copy(io.Discard, resp.Body)

	// Key doesn't exist yet — return 0.
	if result.Result == nil {
		return 0, nil
	}

	return strconv.Atoi(*result.Result)
}
