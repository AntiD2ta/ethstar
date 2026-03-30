# Frontend Design Guidelines for Engineers

> Practical rules, not theory. Every rule here is something you can apply immediately.
> When in doubt, follow the constraint — good design is mostly about consistency.

---

## 1. The Spacing System

**Rule: Use a 4px base grid. Never use arbitrary pixel values.**

Tailwind's spacing scale enforces this automatically:

```
0.5 = 2px    (micro adjustments only)
1   = 4px    (tight: icon padding)
2   = 8px    (compact: between related items)
3   = 12px   (default: between form elements)
4   = 16px   (comfortable: between sections within a card)
6   = 24px   (spacious: between cards/groups)
8   = 32px   (section separation)
12  = 48px   (major section gaps)
16  = 64px   (page-level spacing)
```

**Engineering rule**: Elements that are logically related should be physically closer together.
This is called the **Law of Proximity** — the single most impactful layout principle.

```
BAD (uniform spacing):          GOOD (grouped by proximity):
┌─────────────────┐            ┌─────────────────┐
│ Name            │            │ Name            │
│                 │            │ Email           │
│ Email           │            │ Phone           │  ← related fields grouped tight
│                 │            │                 │
│ Phone           │            │ Street          │
│                 │            │ City            │
│ Street          │            │ Zip             │  ← address group, tight
│                 │            │                 │
│ City            │            │ [Submit]        │  ← action separated
│                 │            └─────────────────┘
│ Zip             │
│                 │
│ [Submit]        │
└─────────────────┘
```

---

## 2. Typography Scale

**Rule: Use a constrained type scale. Maximum 4-5 sizes per page.**

```
text-xs   = 12px  → Fine print, timestamps, badges
text-sm   = 14px  → Secondary text, table cells, metadata
text-base = 16px  → Body text (NEVER go below this for readable content)
text-lg   = 18px  → Subheadings, card titles
text-xl   = 20px  → Section headings
text-2xl  = 24px  → Page titles
text-3xl  = 30px  → Hero/marketing (rarely needed in dashboards)
```

**Weight hierarchy** (use to create emphasis without changing size):
```
font-normal (400)  → Body text
font-medium (500)  → Labels, table headers, subtle emphasis
font-semibold (600) → Headings, important values
font-bold (700)    → Use sparingly — page title at most
```

**The squint test**: Blur your eyes or step back from the screen. Can you still tell what's
most important? If everything looks the same, you lack hierarchy.

---

## 3. Color System

**Rule: The 60-30-10 formula.**

```
60% → Background/neutral   (white, gray-50, slate-950 for dark mode)
30% → Secondary/surface     (gray-100, cards, borders, muted text)
10% → Accent/primary        (your brand color, CTAs, active states)
```

**Semantic color mapping** (use consistently across your entire app):

| Purpose         | Light Mode         | Dark Mode          | Tailwind Example     |
|----------------|--------------------|--------------------|---------------------|
| Background      | white / gray-50    | gray-950 / slate-950| `bg-background`     |
| Surface (cards) | white              | gray-900           | `bg-card`            |
| Border          | gray-200           | gray-800           | `border-border`      |
| Primary text    | gray-900           | gray-50            | `text-foreground`    |
| Secondary text  | gray-500           | gray-400           | `text-muted-foreground` |
| Primary action  | blue-600           | blue-500           | `bg-primary`         |
| Destructive     | red-600            | red-500            | `bg-destructive`     |
| Success         | green-600          | green-500          | `text-green-600`     |
| Warning         | amber-500          | amber-400          | `text-amber-500`     |

**Rule: Never use pure black (#000) for text.** Use gray-900 or slate-900.
Pure black on white creates too much contrast and causes eye strain.

**Rule: Never use color as the ONLY indicator.** Always pair with icons, text, or patterns
(accessibility requirement, but also just good design).

---

## 4. Layout Patterns

### When to use what:

| Pattern | Use When | Tailwind |
|---------|----------|----------|
| **Stack (vertical)** | Default for most content | `flex flex-col gap-4` |
| **Row (horizontal)** | Inline actions, metadata, badges | `flex items-center gap-2` |
| **Grid (equal columns)** | Cards, dashboards, galleries | `grid grid-cols-3 gap-6` |
| **Sidebar + Main** | App shells, settings pages | `flex` with fixed-width sidebar |
| **Split (50/50)** | Comparison views, detail panels | `grid grid-cols-2` |
| **Center constrained** | Content pages, forms | `max-w-2xl mx-auto` |

### Content width constraints:

```
max-w-sm   (384px)  → Login forms, small dialogs
max-w-md   (448px)  → Forms, narrow content
max-w-lg   (512px)  → Content cards
max-w-xl   (576px)  → Single-column content
max-w-2xl  (672px)  → Blog/article content
max-w-4xl  (896px)  → Dashboards with sidebar
max-w-6xl  (1152px) → Wide dashboards
max-w-7xl  (1280px) → Full-width app shells
```

**Rule: Lines of text should never exceed ~75 characters.** Use `max-w-prose` (65ch)
for any long-form text content.

---

## 5. Component Anatomy Patterns

### Card
```
┌─── Card ────────────────────────────┐
│ ┌─ Header ────────────────────────┐ │   p-6
│ │  Title              [Action ▾]  │ │   flex justify-between
│ │  Description / subtitle         │ │   text-muted-foreground
│ └─────────────────────────────────┘ │
│ ┌─ Content ───────────────────────┐ │   p-6 pt-0
│ │                                 │ │
│ │  Main content area              │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│ ┌─ Footer ────────────────────────┐ │   p-6 pt-0, border-t optional
│ │  [Secondary]        [Primary]   │ │   flex justify-end gap-2
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Form
```
┌─── Form ────────────────────────────┐
│  <Title>                            │   text-xl font-semibold
│  <Description>                      │   text-muted-foreground mb-6
│                                     │
│  Label                              │   text-sm font-medium
│  ┌─────────────────────────────┐    │
│  │ Input                       │    │   h-10, border, rounded-md
│  └─────────────────────────────┘    │
│  Helper text or error message       │   text-sm text-muted / text-destructive
│                                     │   gap-4 between field groups
│  Label                              │
│  ┌─────────────────────────────┐    │
│  │ Input                       │    │
│  └─────────────────────────────┘    │
│                                     │
│  ────────────────────────────────   │   separator before actions
│  [Cancel]              [Submit]     │   flex justify-end gap-2
└─────────────────────────────────────┘
```

### Table (Data Display)
```
┌──────────────────────────────────────────────┐
│  Title                        [Filter] [+New]│  flex justify-between mb-4
├──────────┬──────────┬────────┬───────────────┤
│  Name ▲  │  Status  │  Date  │  Actions      │  font-medium text-muted
├──────────┼──────────┼────────┼───────────────┤
│  Item 1  │  ● Active│  Jan 1 │  [Edit] [···] │  hover:bg-muted/50
│  Item 2  │  ○ Draft │  Jan 2 │  [Edit] [···] │  border-b
│  Item 3  │  ● Active│  Jan 3 │  [Edit] [···] │
├──────────┴──────────┴────────┴───────────────┤
│  Showing 1-3 of 42       [< 1 2 3 ... 14 >] │  flex justify-between
└──────────────────────────────────────────────┘
```

---

## 6. State & Feedback Patterns

**Rule: Every async operation needs 3 states. No exceptions.**

| State | What to show | Example |
|-------|-------------|---------|
| **Loading** | Skeleton or spinner | Pulsing gray rectangles matching content shape |
| **Success** | The data + optional toast | Table rows populate, "Saved!" toast |
| **Error** | Error message + retry action | Red alert with "Try again" button |
| **Empty** | Helpful empty state | Icon + "No results" + CTA to create first item |

### Loading patterns (in order of preference):
1. **Skeleton screens** — Gray shapes matching the content layout (best UX)
2. **Inline spinners** — Small spinner next to the action that triggered loading
3. **Progress bars** — For operations with known duration
4. **Full-page spinner** — Last resort, avoid if possible

### Feedback timing:
```
Instant (0ms)      → Button press visual (scale, color change)
Fast (100-300ms)   → Optimistic UI update (toggle, like, star)
Medium (300-1000ms)→ Show inline spinner
Slow (1000ms+)     → Show skeleton/progress + allow cancellation
```

---

## 7. Responsive Design Checklist

**Breakpoints** (Tailwind defaults — use these, don't invent custom ones):
```
sm  = 640px   → Large phones (landscape)
md  = 768px   → Tablets
lg  = 1024px  → Small laptops
xl  = 1280px  → Desktops
2xl = 1536px  → Large desktops
```

**Desktop-first approach** (for dashboards/tools):
```jsx
// Default is desktop, override down
<div className="grid grid-cols-3 md:grid-cols-2 sm:grid-cols-1">
```

**Common responsive patterns:**
- **Stack on mobile**: `flex flex-col md:flex-row`
- **Hide on mobile**: `hidden md:block`
- **Full-width on mobile**: `w-full md:w-auto`
- **Sidebar collapse**: Sidebar becomes hamburger menu below `lg`

---

## 8. Accessibility Quick Wins

These are not optional — they're the equivalent of input validation on an API:

1. **Use semantic HTML**: `<button>` not `<div onClick>`, `<nav>`, `<main>`, `<header>`
2. **All images need alt text**: `<img alt="User avatar for John">` or `alt=""` if decorative
3. **Form inputs need labels**: Always. Use `<Label htmlFor="email">` not placeholder-only
4. **Color contrast**: 4.5:1 minimum (Tailwind's default palette passes this)
5. **Focus visible**: Never `outline-none` without a custom focus ring (`focus-visible:ring-2`)
6. **Keyboard navigation**: Tab through your app. Can you reach everything? Can you activate it?

---

## 9. Dark Mode Rules

If you support dark mode (and you should — it's expected in developer tools):

1. **Don't just invert colors.** Dark backgrounds need slightly different spacing perception.
2. **Reduce contrast in dark mode.** Use gray-50 (not white) for text on dark backgrounds.
3. **Shadows don't work in dark mode.** Use subtle borders or lighter background colors instead.
4. **Use CSS variables** (shadcn/ui does this automatically via `hsl(var(--background))`).

```
Light:  bg-white    text-gray-900   border-gray-200
Dark:   bg-gray-950 text-gray-50    border-gray-800
```

---

## 10. Common Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Do This Instead |
|---|---|---|
| Walls of text | Nobody reads paragraphs in a UI | Use bullet points, cards, whitespace |
| Too many colors | Looks like a circus | Max 1 primary + 1 accent + neutrals |
| Tiny click targets | Frustrating on all devices | Minimum 44x44px for interactive elements |
| No visual feedback | User wonders "did that work?" | Every action gets a visible response |
| Centered everything | Feels unanchored, hard to scan | Left-align text, only center hero content |
| ALL CAPS body text | Hard to read (we read word shapes) | Only use for short labels/badges |
| Icon without label | Ambiguous (what does ✱ mean?) | Always add text label, or tooltip minimum |
| Modal for everything | Interrupts flow, annoying | Use inline expansion, drawers, or new pages |

---

## Quick Reference Card

```
LAYOUT:       flex/grid + gap (never margin for spacing between siblings)
SPACING:      4px grid → 2, 4, 6, 8, 12, 16 in Tailwind units
TYPOGRAPHY:   max 4 sizes per page, 16px body minimum, max-w-prose for text
COLOR:        60% bg / 30% surface / 10% accent, never pure black
HIERARCHY:    size > weight > color (in order of effectiveness)
FEEDBACK:     loading + success + error + empty for every async operation
RESPONSIVE:   desktop-first for tools, mobile-first for marketing
ACCESSIBILITY: semantic HTML + labels + contrast + keyboard + focus rings
```
