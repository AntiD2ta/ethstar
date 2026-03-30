// Package web provides an HTTP handler that serves the embedded frontend.
package web

import "embed"

// content holds the built frontend files.
// Populated at build time by: cd frontend && npm run build
//
//go:embed static/*
var content embed.FS
