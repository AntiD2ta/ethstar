# Maintainer Handbook

Recurring tasks to keep Ethstar's assets, metadata, and content up to date.

---

## Repo List Changes

When adding or removing repositories from `frontend/src/lib/repos.ts`:

1. **Update the repo list** — edit the `REPOSITORIES` array and `CATEGORIES` if needed.
2. **Regenerate the OG image** if the count crosses a new threshold (see below).
3. **Update `index.html` meta description** — the text says "20+ core protocol repositories". Keep it accurate.
4. **Update `index.html` JSON-LD** — the `description` field mentions the repo count.
5. **Update `frontend/public/sitemap.xml`** — bump the `<lastmod>` date.

Files to touch:
- `frontend/src/lib/repos.ts` — repo list
- `frontend/index.html` — meta description, JSON-LD description
- `frontend/public/sitemap.xml` — `<lastmod>`
- `frontend/public/og-image.png` — regenerate if count changed visibly

---

## Regenerating the OG Image

The social preview image (`frontend/public/og-image.png`, 1200x630) is generated from `frontend/scripts/og-image-gen.html`. It uses the browser Canvas API and loads Google Fonts.

### Steps

1. Edit `frontend/scripts/og-image-gen.html` — update the subtitle text on this line:
   ```js
   ctx.fillText('Support 17+ core protocol repositories in a single click', W / 2, titleY + 55);
   ```
   Change `17+` to the current count.

2. Serve the file locally:
   ```bash
   cd frontend/scripts && python3 -m http.server 8899
   ```

3. Open `http://localhost:8899/og-image-gen.html` in Chrome. Wait for fonts to load (status text at the bottom changes to "Ready").

4. Click the canvas to download `og-image.png`.

5. Move the downloaded file to replace the existing one:
   ```bash
   mv ~/Downloads/og-image.png frontend/public/og-image.png
   ```

6. Kill the temp server: `Ctrl+C` in the terminal, or `kill $(lsof -ti :8899)`.

7. Verify in dev: `cd frontend && npm run dev`, then visit `http://localhost:5173/og-image.png`.

### When to regenerate

- Repo count changes visibly (e.g., 17+ to 20+, 20+ to 25+)
- Domain changes
- Branding/design changes

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
| `frontend/index.html` | canonical, og:url, og:image, twitter:image, JSON-LD url |
| `frontend/public/robots.txt` | Sitemap URL |
| `frontend/public/sitemap.xml` | `<loc>` URL |
| `frontend/src/components/share-button.tsx` | Branding text in share image canvas |
| `frontend/scripts/og-image-gen.html` | Domain text in generator |
| `frontend/public/og-image.png` | Regenerate (domain is baked into the image) |
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
