# Local Development Setup

This guide walks you through setting up Ethstar for local development, including creating the GitHub App required for OAuth authentication.

## Prerequisites

- **Go 1.25+** — [install](https://go.dev/dl/)
- **Node.js 22+** — [install](https://nodejs.org/)
- A **GitHub account** to create the GitHub App

## 1. Install Dependencies

```bash
make install    # Go deps + npm install + Playwright browsers
```

## 2. Create a GitHub App

Ethstar authenticates users via a GitHub App with the narrowest possible permission: **Starring only** (no code, issue, or PR access).

1. Go to **https://github.com/settings/apps/new**
2. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **GitHub App name** | `Ethstar Dev` (or any unique name) |
   | **Homepage URL** | `http://localhost:5173` |
   | **Callback URL** | `http://localhost:5173/api/auth/callback` |
   | **Enable Device Flow** | Leave **unchecked** |
   | **Setup URL** | Leave **blank** |
   | **Redirect on update** | Leave **unchecked** |
   | **Webhook active** | **Uncheck this** (important!) |

3. Under **Permissions** → **Account permissions**:
   - Set **Starring** to **Read & Write**
   - Leave everything else as "No access"

4. Scroll down and check **"Request user authorization (OAuth) during installation"**
   - This is required so the install flow also creates an OAuth token

5. Click **Create GitHub App**

6. On the app settings page:
   - Copy the **Client ID** (starts with `Iv1.` or `Iv23.`)
   - Click **Generate a client secret** → copy the secret immediately (it's only shown once)
   - Note the **App slug** from the URL: `https://github.com/settings/apps/<slug>`

## 3. Create a Classic OAuth App (for Starring)

The "Star All" feature requires a **classic OAuth App** (not a GitHub App) because GitHub's starring API requires the `public_repo` scope, which only classic OAuth tokens provide. The token is used ephemerally in the browser and never stored server-side.

1. Go to **https://github.com/settings/applications/new**
2. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Application name** | `Ethstar Star Dev` (or any unique name) |
   | **Homepage URL** | `http://localhost:5173` |
   | **Authorization callback URL** | `http://localhost:5173/api/auth/star-callback` |

3. Click **Register application**
4. On the app settings page:
   - Copy the **Client ID**
   - Click **Generate a new client secret** and copy it immediately

These credentials go into `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` in `.env`.

## 4. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your GitHub App credentials:

```bash
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BASE_URL=http://localhost:5173
```

The `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables are only needed for the vanity star counter on Vercel. Leave them blank for local development — the counter will gracefully degrade.

## 5. Start Development Servers

You need two terminals:

```bash
# Terminal 1: Go API server (loads env vars from .env)
set -a && source .env && set +a && make dev-go    # API on :8080

# Terminal 2: Vite dev server (proxies /api/* to Go)
make dev-frontend                             # Frontend on :5173
```

Visit **http://localhost:5173**.

## 6. Verify the OAuth Flow

1. Click **"Sign in with GitHub"** on the homepage
2. GitHub shows the authorization page — you should see **only** the "Starring" permission
3. Click **Authorize**
4. You're redirected back to `localhost:5173` with your GitHub profile loaded
5. Click **"Star All"** to test the starring flow

## Troubleshooting

### "server misconfiguration" error

The Go server can't find the required environment variables. Make sure you exported them in the terminal running `make dev-go`:

```bash
export $(cat .env | xargs) && make dev-go
```

### "invalid state" error on callback

The OAuth state cookie wasn't set or has expired. This can happen if:
- You took too long to authorize (the state cookie expires in 10 minutes)
- You're using a different browser/incognito window than where you started the flow
- Cookies are blocked for `localhost`

Try the flow again from the beginning.

### Port 8080 already in use

```bash
make kill-server    # Kill any process on :8080
```

### Callback URL mismatch

If GitHub shows a "redirect_uri mismatch" error, verify that your GitHub App's **Callback URL** is exactly:

```
http://localhost:5173/api/auth/callback
```

Note: In local development, the Vite dev server on `:5173` proxies `/api/*` requests to the Go server on `:8080`. The callback URL must use the Vite port (`:5173`), not the Go port.
