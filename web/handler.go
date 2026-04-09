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
