// Package middleware provides HTTP middleware for the application server.
package middleware

import (
	"bufio"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"
)

// responseWriter wraps http.ResponseWriter to capture the status code.
// It preserves the http.Hijacker interface needed for WebSocket upgrades.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Hijack implements http.Hijacker, forwarding to the underlying writer.
// This is required for WebSocket connections that pass through middleware.
func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if h, ok := rw.ResponseWriter.(http.Hijacker); ok {
		return h.Hijack()
	}
	return nil, nil, fmt.Errorf("underlying ResponseWriter does not implement http.Hijacker")
}

// Recovery returns middleware that recovers from panics and returns 500.
func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				slog.Error("panic recovered", "error", err, "path", r.URL.Path) // #nosec G706
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// Logging returns middleware that logs request method, path, status, and duration.
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rw, r)
		if slog.Default().Enabled(r.Context(), slog.LevelInfo) {
			slog.InfoContext(r.Context(), "request", // #nosec G706
				"method", r.Method,
				"path", r.URL.Path,
				"status", rw.statusCode,
				"duration", time.Since(start),
			)
		}
	})
}

// allowedOrigins contains the set of origins permitted for CORS requests.
var allowedOrigins = map[string]bool{
	"http://localhost:5173":  true,
	"http://localhost:8080":  true,
	"http://127.0.0.1:5173": true,
	"http://127.0.0.1:8080": true,
}

// CORS returns middleware that sets CORS headers for allowed origins.
// On preflight (OPTIONS) requests, it also writes Allow-Methods, Allow-Headers,
// and Max-Age. Non-preflight requests only get Allow-Origin.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			// Credentials are required for the oauth_state cookie to flow between
			// the frontend dev server (:5173) and the Go API (:8080).
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		if r.Method == http.MethodOptions {
			if allowedOrigins[origin] {
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				w.Header().Set("Access-Control-Max-Age", "86400")
				w.WriteHeader(http.StatusNoContent)
			} else {
				w.WriteHeader(http.StatusForbidden)
			}
			return
		}

		next.ServeHTTP(w, r)
	})
}

// JSONContentType returns middleware that sets Content-Type: application/json for /api/* routes.
func JSONContentType(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") && !strings.HasPrefix(r.URL.Path, "/api/ws") {
			w.Header().Set("Content-Type", "application/json")
		}
		next.ServeHTTP(w, r)
	})
}

// Chain applies middleware in order. The first middleware in the list is the
// outermost handler (e.g., Chain(h, A, B, C) produces A(B(C(h)))).
func Chain(handler http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		handler = middlewares[i](handler)
	}
	return handler
}
