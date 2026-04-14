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

// Package web provides an HTTP handler that serves the embedded frontend.
package web

import "embed"

// content holds the built frontend files.
// Populated at build time by: cd frontend && npm run build
//
// Use `all:` so the embed picks up the tracked `.gitkeep` placeholder when
// the frontend hasn't been built yet (e.g. fresh CI checkout before `npm
// run build`). Without it, `static/*` excludes dotfiles and the package
// fails to compile on a clean tree.
//
//go:embed all:static/*
var content embed.FS
