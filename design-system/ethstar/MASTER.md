# Ethstar Design System — Master File

> **LOGIC:** This is the single source of truth for Ethstar's design system.
> Ethstar is a single-page app — no page-specific overrides exist.
> If the app grows to multiple pages, add overrides in `design-system/ethstar/pages/[page-name].md`.

---

**Project:** Ethstar
**Generated:** 2026-04-04
**Category:** Ethereum Developer Tool — Dark Premium
**Style:** Dark Elegance + Clean Minimalism (Glassmorphism accents)

---

## Brand Identity

- **Personality:** Approachable, crypto-native, elegant
- **Tone:** Minimal & artistic
- **Logo:** 4-pointed star (Ethstar mark). Rendered as 3D rotating element in hero background.
- **Ethereum affiliation:** Uses ETH diamond colors as anchor palette. "Ethereum" highlighted in blue in headlines.

---

## Color Palette

### Dark Mode (Primary — default)

| Role | Hex | oklch | CSS Variable |
|------|-----|-------|--------------|
| Background | `#111125` | `oklch(0.165 0.025 280)` | `--background` |
| Foreground | `#E8E8F0` | `oklch(0.935 0.008 280)` | `--foreground` |
| Card | `#1A1A35` | `oklch(0.200 0.025 280)` | `--card` |
| Card foreground | `#E8E8F0` | `oklch(0.935 0.008 280)` | `--card-foreground` |
| Popover | `#1A1A35` | `oklch(0.200 0.025 280)` | `--popover` |
| Popover foreground | `#E8E8F0` | `oklch(0.935 0.008 280)` | `--popover-foreground` |
| Primary | `#627EEA` | `oklch(0.620 0.140 270)` | `--primary` |
| Primary foreground | `#FFFFFF` | `oklch(1 0 0)` | `--primary-foreground` |
| Secondary | `#7B3FE4` | `oklch(0.520 0.230 290)` | `--secondary` |
| Secondary foreground | `#FFFFFF` | `oklch(1 0 0)` | `--secondary-foreground` |
| Muted | `#222240` | `oklch(0.235 0.025 280)` | `--muted` |
| Muted foreground | `#8A8AA3` | `oklch(0.640 0.020 280)` | `--muted-foreground` |
| Accent | `#222240` | `oklch(0.235 0.025 280)` | `--accent` |
| Accent foreground | `#E8E8F0` | `oklch(0.935 0.008 280)` | `--accent-foreground` |
| Destructive | `#EF4444` | `oklch(0.637 0.237 25)` | `--destructive` |
| Border | `#2A2A4A` | `oklch(0.270 0.030 280)` | `--border` |
| Input | `#2A2A4A` | `oklch(0.270 0.030 280)` | `--input` |
| Ring | `#627EEA` | `oklch(0.620 0.140 270)` | `--ring` |

### Semantic Colors

| Role | Hex | Usage |
|------|-----|-------|
| Star (unstarred) | `#8A8AA3` | Outline star icon |
| Star (starred) | `#FFD700` | Filled gold star icon |
| Success | `#34D399` | Star completed state |
| Warning | `#FBBF24` | Rate limit warning |
| Info | `#60A5FA` | Informational messages |
| ETH highlight | `#627EEA` | "Ethereum" word highlight in headlines |

### Light Mode (Secondary — toggle available)

| Role | Hex | oklch |
|------|-----|-------|
| Background | `#F5F5FA` | `oklch(0.970 0.005 280)` |
| Foreground | `#1A1A35` | `oklch(0.200 0.025 280)` |
| Card | `#FFFFFF` | `oklch(1 0 0)` |
| Primary | `#4F6AD8` | `oklch(0.560 0.150 270)` |
| Primary foreground | `#FFFFFF` | `oklch(1 0 0)` |
| Secondary | `#6B30D4` | `oklch(0.460 0.230 290)` |
| Muted | `#E8E8F0` | `oklch(0.935 0.008 280)` |
| Muted foreground | `#6A6A83` | `oklch(0.540 0.020 280)` |
| Border | `#D0D0E0` | `oklch(0.860 0.010 280)` |

---

## Typography

| Role | Font Family | Weight | Tracking |
|------|-------------|--------|----------|
| Headlines (h1-h3) | Space Grotesk | 700 | -0.02em |
| Body text | Inter | 400 | 0 |
| Labels / UI | Inter | 500 | 0.01em |
| Code / mono | JetBrains Mono | 400 | 0 |
| Category headers | Space Grotesk | 600 | 0.05em (uppercase) |

### Type Scale

| Level | Size | Line-height |
|-------|------|-------------|
| Display (hero) | clamp(2.5rem, 6vw, 5rem) | 1.1 |
| H1 | 2.25rem / 36px | 1.2 |
| H2 | 1.75rem / 28px | 1.3 |
| H3 | 1.25rem / 20px | 1.4 |
| Body | 1rem / 16px | 1.6 |
| Small | 0.875rem / 14px | 1.5 |
| Caption | 0.75rem / 12px | 1.4 |

**Google Fonts Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap');
```

---

## Effects & Surfaces

### Glassmorphism Cards
```css
.glass-card {
  background: oklch(0.200 0.025 280 / 60%);
  backdrop-filter: blur(12px);
  border: 1px solid oklch(0.350 0.030 280 / 30%);
  border-radius: 12px;
}
```

### Background Pattern
- Subtle diamond/triangle repeating SVG pattern at ~5% opacity
- Overlaid on `#111125` base

### 3D Rotating Logo
- Ethstar 4-pointed star mark rendered in CSS/SVG
- Continuous Y-axis rotation (20s cycle, linear, infinite)
- Semi-transparent, behind hero content
- Subtle glow: `drop-shadow(0 0 40px oklch(0.620 0.140 270 / 30%))`

### Horizontal Marquee (Repo Sections)
- Repo cards scroll perpetually right-to-left
- Speed: ~30s per full cycle
- Pauses on hover
- `animation: marquee 30s linear infinite`
- Duplicated content for seamless loop

---

## Layout

| Token | Value |
|-------|-------|
| Max content width | 1280px |
| Section spacing | 80px (5rem) |
| Card gap | 24px (1.5rem) |
| Border radius (cards) | 12px |
| Border radius (buttons) | 9999px (pill) |
| Border radius (inputs) | 8px |

### Section Structure
```
[Icon] CATEGORY NAME ——————————————————————
  [ card ] [ card ] [ card ] [ card ] → scrolling →
```

- Section header: icon (24px) + uppercase name + horizontal rule
- No numbers, no `//` prefix
- Cards in horizontal overflow with marquee animation

---

## Component Specs

### Primary Button (CTA)
- Background: `--primary` (`#627EEA`)
- Text: white, Inter 500
- Padding: 14px 32px
- Border-radius: 9999px (pill)
- Star icon before text
- Hover: brightness 1.1, subtle lift

### Ghost Button (Secondary CTA)
- Background: transparent
- Border: 1px solid `--border`
- Text: `--foreground`
- Padding: 14px 32px
- Border-radius: 9999px (pill)
- Hover: background `--muted`

### Repo Card
- Glass card style (see Effects)
- Content: org/name (name in `--primary` link color), description, star count
- Bottom row: org avatar + star toggle button
- Star toggle: outlined star (not starred) / filled gold star (starred)
- Width: 320px fixed (for marquee sizing)

---

## Anti-Patterns

- No AI purple/pink gradients
- No emoji as icons — use Lucide React
- No generic blue SaaS aesthetic
- No cluttered dashboard layouts
- No numbers or `//` prefix on section headers
- No layout-shifting hover transforms
- No instant state changes (always transition 150-300ms)
- No `prefers-reduced-motion` violations (disable marquee + rotation)

---

## Accessibility

- Dark mode text contrast: `#E8E8F0` on `#111125` = ~13:1 (AAA)
- Muted text: `#8A8AA3` on `#111125` = ~4.8:1 (AA)
- Primary on dark: `#627EEA` on `#111125` = ~5.2:1 (AA)
- Gold star on dark: `#FFD700` on `#1A1A35` = ~8.5:1 (AAA)
- Focus rings: 2px solid `--ring` with 2px offset
- Marquee: respect `prefers-reduced-motion: reduce`
- 3D rotation: respect `prefers-reduced-motion: reduce`
