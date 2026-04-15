# gosec suppressions

`gosec` runs in `make check`. The following suppressions are legitimate in this codebase; annotate only when one of these applies.

- **G101 (hardcoded credentials)** — Fires on URL constants containing "Token" (e.g., the GitHub OAuth token endpoint URL). Suppress with `#nosec G101 -- URL, not a secret`.
- **G117 (hardcoded credentials in struct tag)** — Fires on struct fields tagged `json:"access_token"` / `json:"refresh_token"`. These are response shapes, not embedded secrets. Suppress with `#nosec G117 -- field name, not a secret`.
- **G124 (CWE-614: insecure `http.Cookie`)** — Despite the name, this is cookie security, NOT file permissions. Fires on any `http.SetCookie` where `Secure: false` is reachable. Required for env-driven cookies where `Secure` must be `false` on plaintext localhost dev (browsers reject `Secure` cookies over `http://`). Suppress with `#nosec G124 -- CWE-614: Secure is per-env; HttpOnly+SameSite always set`.
- **G704 (SSRF via user input)** — Place the annotation on the `http.DefaultClient.Do(req)` line, not the function signature. gosec only reads annotations on the flagged line.
- **G706 (log injection)** — Fires on `slog.Info/Error` calls with HTTP request data. `slog` uses key-value pairs, not string interpolation, so injection isn't possible here. Suppress with `#nosec G706 -- slog structured logging, no interpolation`.

## Rule of thumb

Never suppress without a comment. Every `#nosec` must include a `--` reason so reviewers can tell intent from laziness.
