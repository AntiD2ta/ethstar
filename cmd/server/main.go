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

// Command server runs the application, serving both the API and the embedded
// frontend as a single binary.
package main

import (
	"context"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"ethstar/internal/api"
	"ethstar/pkg/auth"
	"ethstar/internal/middleware"
	"ethstar/web"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "HTTP listen address")
	flag.Parse()

	baseURL := envOr("BASE_URL", "http://localhost:5173")
	if err := auth.ValidateBaseURL(baseURL); err != nil {
		slog.Error("invalid BASE_URL", "error", err)
		os.Exit(1)
	}

	// CookieSecure is off by default for local HTTP dev. Set ETHSTAR_COOKIE_SECURE=1
	// when running behind TLS (e.g. a reverse proxy in staging).
	apiCfg := api.Config{
		GitHubClientID:     os.Getenv("GITHUB_CLIENT_ID"),
		GitHubClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
		BaseURL:            baseURL,
		CookieSecure:       os.Getenv("ETHSTAR_COOKIE_SECURE") == "1",
		OAuthClientID:      os.Getenv("OAUTH_CLIENT_ID"),
		OAuthClientSecret:  os.Getenv("OAUTH_CLIENT_SECRET"),
	}

	mux := http.NewServeMux()

	// API routes.
	mux.Handle("/api/", api.Handler(apiCfg))

	// Frontend (SPA) — serves embedded static files, falls back to index.html.
	mux.Handle("/", web.Handler())

	handler := middleware.Chain(mux,
		middleware.Recovery,
		middleware.Logging,
		middleware.CORS,
		middleware.JSONContentType,
	)

	srv := &http.Server{
		Addr:              *addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	done := make(chan struct{})
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		sig := <-sigCh
		slog.Info("shutting down", "signal", sig)

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			slog.Error("shutdown error", "error", err)
		}
		close(done)
	}()

	slog.Info("server listening", "addr", *addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
	<-done
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
