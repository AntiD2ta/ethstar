package web

import (
	"io/fs"
	"net/http"
	"strings"
)

// Handler returns an http.Handler that serves the embedded frontend.
//
// It implements SPA (Single Page Application) routing: any request that
// doesn't match a static file is served index.html, letting the frontend
// router handle the path.
func Handler() http.Handler {
	static, err := fs.Sub(content, "static")
	if err != nil {
		panic("web: failed to create sub filesystem: " + err.Error())
	}

	fileServer := http.FileServer(http.FS(static))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Clean the path.
		path := strings.TrimPrefix(r.URL.Path, "/")

		// Check if the file exists in the embedded filesystem.
		// If it does, serve it directly. Otherwise, serve index.html
		// for client-side (SPA) routing.
		if path != "" {
			if _, err := fs.Stat(static, path); err == nil {
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// File not found — serve index.html for SPA routing.
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
