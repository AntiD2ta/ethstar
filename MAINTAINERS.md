# Maintainer Handbook

Recurring tasks to keep Ethstar's assets, metadata, and content up to date.

---

## Repo List Changes

Want to add a repository? Fork the repo, make the changes below, and open a Pull Request. The [PR template](/.github/pull_request_template.md) includes a checklist to make sure nothing is missed.

### How to contribute a new repo

1. **Fork** this repository on GitHub.
2. Pick the right **category** for the repo (see table below).
3. Edit the files listed under "Files to update".
4. Run `cd frontend && npx vitest run src/lib/repos.test.ts` to verify the repo count stays in sync.
5. Open a **Pull Request** against `main` — the PR template will guide you through the final checklist.

### Categories

Repos are organized into four categories. Use these descriptions to decide where a new repo belongs:

| Category | What belongs here |
|---|---|
| **Ethereum Core** | Foundational protocol repositories: the EVM specification, EIPs, core protocol libraries, and cross-layer API clients. |
| **Consensus Clients** | Beacon chain / consensus layer client implementations (Prysm, Lighthouse, Teku, Lodestar, Nimbus, Grandine). |
| **Execution Clients** | Execution layer client implementations (Geth, Nethermind, Besu, Erigon, Reth). |
| **Validator Tooling** | Validator clients, remote signers, distributed validator middleware, node setup/management tools, monitoring, and infrastructure utilities for stakers and operators. |

### Files to update

- `frontend/src/lib/repos.ts` — add the entry to the `REPOSITORIES` array
- `api/og/index.tsx` — update `REPO_COUNT` to match the new `REPOSITORIES.length`
- `README.md` — add the repo to the appropriate table
- `frontend/index.html` — update meta description and JSON-LD if the count crosses a round number
- `frontend/public/sitemap.xml` — bump the `<lastmod>` date

---

## OG Image (Social Preview)

The social preview image is **dynamically generated** by a Vercel serverless function at `/api/og` using `@vercel/og` (Satori). It renders the Ethereum diamond, title, repo count subtitle, and domain at 1200x630.

### How it works

- **Endpoint**: `api/og/index.tsx` — Node.js Vercel Function using `@vercel/og`
- **Repo count**: Hardcoded as `REPO_COUNT` in `api/og/index.tsx`
- **Sync check**: A Vitest test in `frontend/src/lib/repos.test.ts` verifies `REPO_COUNT` matches `REPOSITORIES.length`
- **Fonts**: Space Grotesk 700 and Inter 400, fetched from Google Fonts at cold start
- **Cache**: CDN caches for 24 hours; cache purges automatically on each Vercel deploy

### Updating the repo count

1. Edit `REPO_COUNT` in `api/og/index.tsx` to match the new `REPOSITORIES.length`.
2. Run `cd frontend && npx vitest run src/lib/repos.test.ts` — the sync test will fail if the values don't match.
3. Deploy. The OG image updates automatically.

### Static fallback & GitHub social preview

`frontend/public/og-image.png` is kept as a static fallback and design reference. `social-preview.png` (repo root) is the same image, uploaded to GitHub repo Settings as the social preview.

To regenerate both:

```bash
# Start Vite dev server
cd frontend && npm run dev &

# Capture with Playwright
npx playwright screenshot \
  --viewport-size="1280,640" --full-page \
  "http://localhost:5173/scripts/og-image-gen.html" \
  public/og-image.png

# Copy to repo root for GitHub social preview
cp public/og-image.png ../social-preview.png
```

The source template is `frontend/scripts/og-image-gen.html`. Edit it to change layout, colors, or text, then re-run the Playwright capture above.

### Previewing in production

- Visit `https://ethstar.dev/api/og` directly in a browser to see the rendered PNG
- Use [Open Graph Debugger](https://en.rakko.tools/tools/9/) to test how social platforms will render the preview
- Twitter, Facebook, and Slack cache OG images aggressively — use each platform's debug tool to force a re-scrape after changes

---

## Regenerating Logo Assets

The 3D Ethereum diamond logo is rendered via Three.js in `frontend/scripts/capture-logo.html`. The script renders the same diamond, wireframe globe, bloom post-processing, and emissive pulse as the live hero section.

### Assets inventory

| File | Size | Used in |
|------|------|---------|
| `frontend/public/logo.png` | 2048x2048 | Source master — not served directly |
| `frontend/public/logo-1024.png` | 1024x1024 | — |
| `frontend/public/logo-512.png` | 512x512 | — |
| `frontend/public/logo-256.png` | 256x256 | — |
| `frontend/public/logo-128.png` | 128x128 | Header, share image |
| `frontend/public/logo-64.png` | 64x64 | — |
| `frontend/public/favicon.svg` | SVG | Browser tab icon (flat 2D version) |

### Capturing a new logo

The capture script imports Three.js from `node_modules/`, so it must be served from the `frontend/` directory root (not from `scripts/`).

1. Start the Vite dev server (it serves the `frontend/` tree):
   ```bash
   cd frontend && npm run dev
   ```

2. Open the capture page at `http://localhost:5173/scripts/capture-logo.html` in Chrome.

3. The 3D diamond rotates on a 20-second cycle with a 3-second emissive pulse. Watch it rotate and wait for a visually appealing angle.

4. Choose the capture size from the dropdown (default: 1024x1024). For the master `logo.png`, select **2048**.

5. Click **"Capture as logo.png"** — the PNG downloads and a preview appears below.

6. Repeat at each size you need, or capture at 2048 and resize down (see next section).

### Generating sized variants from the master

If you have ImageMagick or `sips` (built into macOS):

```bash
cd frontend/public

# Using sips (macOS built-in — no install needed)
for size in 1024 512 256 128 64; do
  sips -z $size $size logo.png --out logo-${size}.png
done

# Or using ImageMagick
for size in 1024 512 256 128 64; do
  convert logo.png -resize ${size}x${size} logo-${size}.png
done
```

### When to regenerate

- 3D diamond geometry or materials change (`frontend/src/components/saturn-carousel/ethereum-diamond.tsx`)
- Lighting or bloom settings change (`frontend/src/components/saturn-carousel/scene-lighting.tsx`)
- You want a different rotation angle or capture moment
- The favicon SVG (`frontend/public/favicon.svg`) is separate — it's a flat 2D version and must be edited independently

---

## Domain References

If the domain changes (currently `ethstar.dev`), update these files:

| File | What to change |
|------|----------------|
| `frontend/index.html` | canonical, og:url, JSON-LD url (og:image and twitter:image point to `/api/og`) |
| `frontend/public/robots.txt` | Sitemap URL |
| `frontend/public/sitemap.xml` | `<loc>` URL |
| `frontend/src/components/share-button.tsx` | Branding text in share image canvas |
| `api/og/index.tsx` | `DOMAIN` constant |
| `frontend/scripts/og-image-gen.html` | Domain text in static generator |
| `frontend/public/og-image.png` | Regenerate static fallback if needed (domain is baked in) |
| `.env.example` | BASE_URL comment |

Quick find-and-replace:
```bash
# Preview what would change (exclude node_modules, .git, web/static)
grep -r "ethstar\.dev" --include="*.html" --include="*.tsx" --include="*.ts" --include="*.txt" --include="*.xml" --include="*.json" frontend/ .env.example
```

---

## Sitemap Maintenance

`frontend/public/sitemap.xml` — currently lists only the homepage. If routes are added to `frontend/src/App.tsx`, add corresponding `<url>` entries to the sitemap.

After any content change, bump the `<lastmod>` date to today's date (YYYY-MM-DD format).

---

## SEO Checklist (Per Deploy)

Quick checks before a production deploy:

- [ ] `make check` passes (lint, typecheck, security)
- [ ] Meta tags in `index.html` are accurate (title, description, OG, Twitter)
- [ ] `og-image.png` repo count matches reality
- [ ] `sitemap.xml` `<lastmod>` is current
- [ ] `robots.txt` sitemap URL uses the correct domain
- [ ] JSON-LD description is accurate

---

## Vercel Cache Headers

Static assets have cache headers configured in `vercel.json`:

| Pattern | Cache-Control |
|---------|---------------|
| `/assets/*` (Vite hashed bundles) | `public, max-age=31536000, immutable` |
| `/logo-*.png` | `public, max-age=31536000` |
| `/favicon.svg` | `public, max-age=31536000` |

`og-image.png` is not explicitly cached — social platforms cache it on their side. If you update the OG image and need platforms to re-fetch it, append a query string to the URL in `index.html` temporarily (e.g., `og-image.png?v=2`), then remove it after caches refresh.
