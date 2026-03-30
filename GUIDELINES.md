# Frontend Development Guidelines

> For backend engineers building frontend with React and Go.
> This document is an educational reference — it teaches the concepts and patterns, not project-specific structure.
> For project architecture, conventions, and commands, see [DNA.md](DNA.md).

---

## Table of Contents

1. [Mental Models: Backend to Frontend](#mental-models-backend--frontend)
2. [React Core Concepts](#react-core-concepts)
3. [Design System Rules](#design-system-rules)
4. [UX Fundamentals](#ux-fundamentals)
5. [Component Patterns](#component-patterns)
6. [State and Feedback Patterns](#state--feedback-patterns)
7. [Testing with Playwright](#testing-with-playwright)
8. [Working with Claude Code](#working-with-claude-code)
9. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
10. [Resources](#resources)

---

## Mental Models: Backend → Frontend

| Backend Concept | Frontend Equivalent | Example |
|---|---|---|
| Service / microservice | Component | `<ProfileCard>`, `<DataTable>` |
| API contract (request/response types) | Props (component interface) | `interface ProfileCardProps { name: string; role: string }` |
| Database state | Application state | `useState`, `useContext`, URL params |
| Request/response cycle | User interaction → state change → re-render | Click button → `setState` → UI updates |
| Middleware chain | Layout components | `<RootLayout>` wraps all pages |
| Configuration / env vars | Theme / design tokens | CSS variables in `index.css` |
| Utility package | Custom hook | `useLocalStorage`, `useFetch` |
| Error handling (try/catch, error codes) | Loading/error/empty states | Skeleton → data OR error message |
| Integration test | Playwright E2E test | `await page.click('button')` |

**The fundamental equation**: `UI = f(state)`.
Your component tree is a pure function of state. Every user interaction mutates state, React re-renders the affected subtree. That's it. Everything else is details.

---

## React Core Concepts

### Components

A component is a function that takes props and returns JSX:

```tsx
interface GreetingProps {
  name: string;
  role?: string;  // optional prop
}

function Greeting({ name, role = "user" }: GreetingProps) {
  return (
    <div>
      <h1>Hello, {name}</h1>
      <p>Role: {role}</p>
    </div>
  );
}
```

### State (useState)

Local, component-scoped state. When the setter is called, the component re-renders:

```tsx
const [count, setCount] = useState(0);           // number
const [items, setItems] = useState<Item[]>([]);   // typed array
const [isOpen, setIsOpen] = useState(false);      // boolean
```

### Effects (useEffect)

Side effects: fetching data, subscriptions, timers. Runs after render:

```tsx
useEffect(() => {
  // This runs after render when `userId` changes
  fetchUser(userId).then(setUser);

  // This cleanup runs before the next effect or on unmount
  return () => cancelRequest();
}, [userId]);  // dependency array — WHEN to re-run
```

**Rules:**
- `[]` → run once on mount
- `[a, b]` → run when `a` or `b` changes
- No array → run on every render (rarely what you want)

### Derived State

Compute values during render — don't store them separately:

```tsx
// WRONG: extra state + effect, causes extra re-render
const [fullName, setFullName] = useState("");
useEffect(() => setFullName(first + " " + last), [first, last]);

// RIGHT: derived during render, no extra state
const fullName = first + " " + last;
```

### Custom Hooks

Extract reusable stateful logic:

```tsx
function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initial;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
```

---

## Design System Rules

### Spacing (4px grid)

Use Tailwind's spacing scale. Never use arbitrary pixel values:

```
p-1  = 4px    (tight: icon padding)
p-2  = 8px    (compact: between related items)
p-3  = 12px   (default: between form elements)
p-4  = 16px   (comfortable: within a card)
p-6  = 24px   (spacious: between cards/groups)
p-8  = 32px   (section separation)
p-12 = 48px   (major section gaps)
p-16 = 64px   (page-level spacing)
```

**Law of Proximity**: Related elements should be physically closer together.

### Typography (max 4-5 sizes per page)

```
text-sm   = 14px  → Secondary text, table cells, metadata
text-base = 16px  → Body text (MINIMUM for readable content)
text-lg   = 18px  → Subheadings, card titles
text-xl   = 20px  → Section headings
text-2xl  = 24px  → Page titles
```

**Weight hierarchy** (create emphasis without changing size):
- `font-normal` (400) → body text
- `font-medium` (500) → labels, table headers
- `font-semibold` (600) → headings, important values

### Color (60-30-10 rule)

```
60% → Background (bg-background)
30% → Surface/secondary (bg-card, text-muted-foreground)
10% → Accent/primary (bg-primary, text-primary)
```

Semantic colors are defined as CSS variables in `index.css`:
- `bg-background` / `text-foreground` → main page
- `bg-card` / `text-card-foreground` → cards and surfaces
- `bg-primary` / `text-primary-foreground` → CTAs, active states
- `bg-destructive` → delete, error actions
- `text-muted-foreground` → secondary text

### Layout Patterns

| Pattern | Use When | Tailwind |
|---|---|---|
| Vertical stack | Default for most content | `flex flex-col gap-4` |
| Horizontal row | Inline actions, metadata | `flex items-center gap-2` |
| Grid | Cards, dashboards | `grid grid-cols-3 gap-6` |
| Center constrained | Forms, content pages | `max-w-2xl mx-auto` |

**Content width**: Lines of text should never exceed ~75 characters. Use `max-w-prose` for long-form text.

---

## UX Fundamentals

### The 5 Rules That Cover 80% of Good UX

1. **Hierarchy** — Not everything is equally important. Use size, weight, and color to guide the eye. One primary action per screen.

2. **Consistency** — Same action = same appearance everywhere. The design system enforces this.

3. **Spacing** — Use the 4px grid consistently. Group related things closer (proximity).

4. **Feedback** — Every user action needs a visible response: loading spinners, success toasts, error messages. (Same principle as API responses.)

5. **Progressive disclosure** — Don't show everything at once. Show the common case, hide advanced options behind a click.

### The Squint Test

Blur your eyes or step back from the screen. Can you still tell what's most important? If everything looks the same, you lack hierarchy.

---

## Component Patterns

### Card Anatomy
```
┌─── Card ──────────────────────────────┐
│  CardHeader                           │  p-6
│    CardTitle + CardDescription        │
│  CardContent                          │  p-6 pt-0
│    [Main content]                     │
│  CardFooter (optional)                │  p-6 pt-0, flex justify-end gap-2
│    [Secondary]          [Primary]     │
└───────────────────────────────────────┘
```

### Form Pattern
```
Label                         ← text-sm font-medium
┌──────────────────────┐
│ Input                │      ← h-10, border, rounded-md
└──────────────────────┘
Helper text or error           ← text-sm text-muted / text-destructive
                               ← gap-4 between field groups
```

### Table Pattern
```
Title + Actions bar            ← flex justify-between mb-4
Column headers (sortable)      ← font-medium text-muted
Data rows                      ← hover:bg-muted/50, border-b
Pagination                     ← flex justify-between mt-4
```

---

## State & Feedback Patterns

### Every async operation needs these states:

| State | What to Show | shadcn Component |
|---|---|---|
| **Loading** | Skeleton shapes matching content | `<Skeleton>` |
| **Success** | The actual data | Your components |
| **Error** | Error message + retry button | `<Alert variant="destructive">` |
| **Empty** | Icon + message + CTA to create | Custom empty state |

### Feedback timing:
- **Instant** (0ms) → Button press visual (scale, color)
- **Fast** (100-300ms) → Optimistic UI update
- **Medium** (300-1000ms) → Show inline spinner
- **Slow** (1000ms+) → Show skeleton/progress

### Toast notifications (using Sonner):
```tsx
import { toast } from "sonner";

toast.success("Changes saved");
toast.error("Failed to save. Please try again.");
toast.loading("Saving...");
```

---

## Testing with Playwright

### Philosophy

Test what users do, not implementation details. Each test should:
1. Navigate to a page
2. Interact like a user would (click, type, select)
3. Assert what the user should see

### Locator Priority (most reliable first)

```tsx
page.getByRole("button", { name: "Submit" })  // Best: accessible role + name
page.getByLabel("Email")                       // Good: form labels
page.getByText("Welcome back")                 // Good: visible text
page.getByTestId("submit-btn")                 // OK: explicit test IDs
page.locator(".my-class")                      // Avoid: implementation detail
```

### Pattern: Page Object Model

For complex pages, extract interactions into helper objects:

```tsx
// e2e/pages/login.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.page.getByLabel("Email").fill(email);
    await this.page.getByLabel("Password").fill(password);
    await this.page.getByRole("button", { name: "Sign in" }).click();
  }
}
```

---

## Working with Claude Code

### The Prompt Framework

Always structure your requests with:

```
## Context
[What exists now]

## Goal
[What should exist after]

## Constraints
[Tech requirements, design rules, what to preserve]

## Acceptance Criteria
[How you'll know it's done — specific, testable]
```

### Describe Workflows, Not Interfaces

**Bad**: "Add a settings page with a nice layout"

**Good**: "Add a settings page at /settings with three sections:
1. Profile: text inputs for name and email, save button
2. Appearance: toggle for dark mode, radio group for density (compact/comfortable)
3. Danger zone: delete account button with confirmation dialog"

### Iterative Building

Build one page at a time, not the whole app at once:

1. **Scaffold** the page with mock data
2. **Wire up** real data (API calls, localStorage)
3. **Add interactions** (forms, filters, sorting)
4. **Polish** (loading states, error handling, animations)
5. **Test** with Playwright

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Do Instead |
|---|---|---|
| Storing derived state in `useState` | Extra re-renders, stale data risk | Compute during render |
| `useEffect` for everything | Most effects are unnecessary | Use event handlers for user actions |
| Walls of text in UI | Nobody reads paragraphs | Use bullet points, cards, whitespace |
| Too many colors | Looks unprofessional | 1 primary + 1 accent + neutrals |
| Tiny click targets | Frustrating on all devices | Minimum 44x44px interactive elements |
| No visual feedback | User wonders "did that work?" | Every action gets a visible response |
| Icon without label | Ambiguous meaning | Always add text label or tooltip |
| Centering everything | Hard to scan, unanchored | Left-align text, center only hero content |
| Building components from scratch | Reinventing wheels, inconsistency | Use shadcn/ui components |
| Over-engineering state management | Redux for a form? No. | Start with useState + useContext |

---

## Resources

1. **[Tailwind CSS Docs](https://tailwindcss.com/docs)** — Core Concepts section
2. **[shadcn/ui Components](https://ui.shadcn.com/)** — Browse available components
3. **[React.dev](https://react.dev/learn)** — Official React docs ("Thinking in React", "Managing State")
4. **[Playwright Docs](https://playwright.dev/docs/intro)** — Getting Started + Best Practices
5. **"Refactoring UI" by Adam Wathan & Steve Schoger** — Design book written for developers
