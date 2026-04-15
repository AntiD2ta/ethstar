# OAuth

Two separate OAuth flows coexist:
- **Login flow** — GitHub App, used for reading user identity + rate-limited repo lookups. HttpOnly cookie-backed session.
- **Star flow** — Classic OAuth App (required for the starring endpoint). Popup + `postMessage` to the opener; ephemeral token, never persisted.

## Flow patterns

- **Popup + postMessage**: The star OAuth callback returns HTML (not a redirect) that `window.opener.postMessage({type: 'ethstar-star-token', access_token})` and closes itself. The opener listens, validates the `type`, resolves a promise, and discards the token after use.
- **Ephemeral tokens**: Obtain broad-scope token in the popup, use it once (star batch), discard. `starAll` accepts an optional `token` param; it skips refresh on 401 when the token is ephemeral.
- **State cookies are per-flow**. Use `SetNamedStateCookie(w, name, state, secure)` so the login and star flows don't collide. The non-parameterized `SetStateCookie` delegates to this.

## Platform quirks

- **GitHub returns HTTP 200 for OAuth errors** with `error` + `error_description` in the JSON body. Decode into a struct that captures both token and error fields in one pass, then branch on `error`.
- **GitHub 403 is not always rate-limit**: read the body. "rate limit"/"abuse detection" → `RateLimitError` (retry); "Resource not accessible"/"Forbidden" → `ForbiddenError` (propagate). Use `classify403()`.
- **GitHub App tokens cannot star cross-org repos** — GitHub returns "Resource not accessible by integration" even for repos the user has access to. Use the classic OAuth App flow for starring. Classic tokens don't expire; the callback normalizes to 10-year TTL for the cookie.

## Cookie `Secure` flag

`Secure: true` is rejected on `http://localhost` (browsers silently drop the cookie). Drive from `ETHSTAR_COOKIE_SECURE=1` env var. In Vercel serverless, use a package-level initializer:

```go
var secureCookie = func() bool { return os.Getenv("ETHSTAR_COOKIE_SECURE") == "1" }()
```

Both OAuth handlers (login + star-callback) must share the same default — mismatched defaults between handlers cause "works in one flow, fails in the other" bugs.

## URL/path quirks

- The Vercel star-callback endpoint is `api/auth/star-callback/`, **not** `api/auth/star/callback/`. A flat directory avoids ambiguity with `api/auth/star/index.go`. Local dev's handler must register the same path.
