# Frontend Exercises: Zero to Productive

> Each exercise builds on the previous one. Work through them in order.
> Each includes the prompt to give Claude Code, what to observe, and what to learn.

---

## Prerequisites

Before starting, scaffold your playground:

```
Prompt to Claude Code:
────────────────────────
Create a new Next.js 14 project in ./learn-react with:
- App Router, TypeScript strict mode
- Tailwind CSS with the default config
- shadcn/ui initialized with "new-york" style and "slate" base color
- Add these shadcn components: button, card, input, label, table, badge,
  dialog, dropdown-menu, toast, tabs, skeleton, separator
- A clean home page that just says "Learning React" with a navigation
  placeholder
```

---

## Exercise 1: Static Component — Profile Card

**What you'll learn**: Component structure, props, Tailwind styling, visual hierarchy

```
Prompt to Claude Code:
────────────────────────
In the learn-react project, create a ProfileCard component at
components/profile-card.tsx. It should accept these props:
  - name: string
  - role: string
  - email: string
  - avatarUrl: string (optional, show initials if missing)
  - status: "active" | "away" | "offline"

Display it as a shadcn Card with:
  - Avatar (circle with image or initials) on the left
  - Name (semibold, large), role (muted), email (small, muted) stacked on the right
  - Status shown as a colored dot badge (green/amber/gray)

Add a demo page at /profiles that shows 3 ProfileCards with different data
and statuses.
```

**After Claude builds it, study these things:**
- [ ] Open `components/profile-card.tsx` — read how props are typed with TypeScript interfaces
- [ ] Notice how Tailwind classes create visual hierarchy (text sizes, colors, font weights)
- [ ] Look at how the conditional avatar (image vs initials) is implemented
- [ ] Inspect the spacing — what gap/padding values are used?

**Stretch**: Ask Claude to add a hover effect and a click handler that logs to console.

**Key concept**: A React component is a function that takes props and returns JSX.
Props are the component's API contract — like a function signature.

---

## Exercise 2: Interactive State — Task Form

**What you'll learn**: useState, form handling, validation, user feedback

```
Prompt to Claude Code:
────────────────────────
Create a task creation form at /tasks/new with these fields:
  - Title (required, min 3 characters)
  - Description (optional, textarea)
  - Priority: low | medium | high (radio group or select)
  - Due date (optional, date picker)

Requirements:
  - Show validation errors inline below each field (red text, appears on blur)
  - Submit button disabled until form is valid
  - On submit, show a success toast and reset the form
  - Use shadcn form components (Input, Label, Textarea, Select, Button)
  - Store the submitted tasks in React state (no backend needed)
  - Show the list of submitted tasks below the form in a simple table
```

**After Claude builds it, study these things:**
- [ ] Find all `useState` calls — each one is a piece of component state
- [ ] Trace what happens when you type in an input: onChange → setState → re-render
- [ ] Look at the validation logic — when does it run? (onBlur vs onChange vs onSubmit)
- [ ] Notice how the form reset works after submission

**Stretch**: Ask Claude to add an "edit" button on each task row that populates the form.

**Key concept**: `useState` is React's simplest state primitive. When you call the setter,
React re-renders the component with the new value. State is LOCAL to the component.

---

## Exercise 3: Data Display — Sortable Table

**What you'll learn**: Data rendering, sorting, filtering, derived state

```
Prompt to Claude Code:
────────────────────────
Create a /dashboard page with a data table showing mock server metrics:
  - 20 rows of data with: hostname, status (healthy/degraded/down),
    cpu_percent, memory_percent, uptime_hours, last_check (timestamp)
  - Generate realistic mock data in a separate file (lib/mock-data.ts)

Table features:
  - Click column headers to sort (toggle asc/desc, show arrow indicator)
  - Filter bar above: text search (filters hostname), status dropdown filter
  - Status shown as colored badges (green/amber/red)
  - CPU and memory shown as small inline progress bars that turn red above 90%
  - Row click selects it (highlighted background)
  - Show "X of Y results" count below the table

Use shadcn Table, Badge, Input, Select components.
```

**After Claude builds it, study these things:**
- [ ] How is sorting implemented? (compare functions, state for sort column + direction)
- [ ] How does filtering work? (derived state: filtered = data.filter(...).sort(...))
- [ ] Notice that the original data never changes — only the VIEW changes
- [ ] Look at the conditional styling for status badges and progress bars

**Stretch**: Ask Claude to add pagination (10 items per page).

**Key concept**: Derived state (sorting, filtering) should be computed during render,
not stored in separate state. `useMemo` can optimize this if the computation is expensive.

---

## Exercise 4: Async Data — API Integration

**What you'll learn**: useEffect, loading/error states, async patterns

```
Prompt to Claude Code:
────────────────────────
Create a /github page that fetches and displays GitHub repositories:
  - Use the public GitHub API (no auth needed): https://api.github.com/users/{username}/repos
  - Text input at top to enter a GitHub username, with a "Search" button
  - Show a skeleton loader (3 skeleton cards) while fetching
  - Show an error state with retry button if the fetch fails
  - Show an empty state if the user has no repos
  - Display repos as cards in a grid: name, description, language (colored dot),
    stars count, forks count, updated date
  - Sort by stars descending by default
  - Cache the results so switching back to a previously searched user is instant

Handle all edge cases:
  - Network error
  - User not found (404)
  - Rate limit exceeded (403)
  - Loading while already loading (cancel previous request)
```

**After Claude builds it, study these things:**
- [ ] How does `useEffect` trigger the fetch? What's in the dependency array?
- [ ] Find the 4 states: loading, success, error, empty — how does the UI switch between them?
- [ ] How is request cancellation handled? (AbortController or state check)
- [ ] Look at the caching strategy — where is cached data stored?

**Stretch**: Ask Claude to add infinite scroll or a "load more" button for users with many repos.

**Key concept**: `useEffect` is for side effects (fetching data, subscriptions, timers).
The dependency array controls WHEN the effect re-runs. An empty array `[]` means "on mount only."

---

## Exercise 5: Component Composition — App Shell

**What you'll learn**: Layout components, routing, shared state, context

```
Prompt to Claude Code:
────────────────────────
Create a proper app shell layout for the learn-react project:

1. Sidebar navigation (left, 256px wide, collapsible to icons-only):
   - Logo/app name at top
   - Navigation links: Dashboard, Profiles, Tasks, GitHub, Settings
   - Active link highlighted
   - Collapse/expand toggle button at bottom
   - Persist collapse state in localStorage

2. Top bar:
   - Breadcrumb showing current page path
   - Right side: theme toggle (light/dark) and a user avatar dropdown
   - The dropdown has: Profile, Settings, Sign out (all can be no-ops)

3. Main content area:
   - Scrolls independently from sidebar
   - Consistent padding
   - All previous exercise pages accessible through sidebar links

4. Theme support:
   - Light/dark toggle that applies across the whole app
   - Persist preference in localStorage
   - Use next-themes package

Wire up all the pages from previous exercises under this shell.
```

**After Claude builds it, study these things:**
- [ ] How is the layout structured? (look at `app/layout.tsx` vs page layouts)
- [ ] How does the sidebar know which link is active? (pathname matching)
- [ ] How is dark mode state shared across the entire app? (context/provider pattern)
- [ ] How does localStorage persistence work with React state?

**Stretch**: Ask Claude to make the sidebar responsive (hamburger menu on mobile).

**Key concept**: Layout components in Next.js persist across page navigations.
They're the equivalent of middleware in a backend — they wrap the request (page render)
and can inject shared functionality.

---

## Exercise 6: Forms & Modals — CRUD Operations

**What you'll learn**: Complex state management, optimistic updates, confirmation patterns

```
Prompt to Claude Code:
────────────────────────
Enhance the /tasks page into a full CRUD task manager:

1. Task list as a table with inline status toggle (checkbox)
2. "New Task" button opens a sheet/drawer from the right (not a modal)
3. Click a task row to open detail view in the same sheet
4. Edit form pre-populated with task data
5. Delete button with confirmation dialog ("Are you sure?")
6. Optimistic updates:
   - Toggling status updates UI immediately, reverts on error
   - Show subtle "Saving..." indicator during save
7. Bulk operations:
   - Checkbox column for multi-select
   - Bulk delete and bulk status change
8. Store all data in localStorage with a custom useLocalStorage hook

The custom hook should:
  - Accept a key and initial value
  - Sync with localStorage
  - Work with SSR (handle window undefined)
  - Type-safe with generics
```

**After Claude builds it, study these things:**
- [ ] How does optimistic UI work? (update state immediately, revert on error)
- [ ] Examine the useLocalStorage hook — how does it sync React state with browser storage?
- [ ] How are bulk operations implemented? (selected IDs in state, batch updates)
- [ ] Look at the sheet/drawer pattern vs modal — when is each appropriate?

**Key concept**: Custom hooks (`use...`) extract reusable stateful logic.
They're the React equivalent of a utility package that carries its own state.

---

## Exercise 7: Real-Time & Polish — WebSocket Dashboard

**What you'll learn**: WebSocket integration, real-time UI, animations, production polish

```
Prompt to Claude Code:
────────────────────────
Create a real-time system monitoring dashboard at /monitor:

1. Backend: Create a simple Node.js WebSocket server (separate file, runs on port 8080)
   that emits fake server metrics every second for 5 servers

2. Dashboard shows:
   - 5 server cards in a grid, each showing:
     - Server name and status indicator (pulsing green dot when healthy)
     - CPU gauge (circular progress or bar)
     - Memory gauge
     - Network I/O sparkline (last 60 seconds)
   - Connection status indicator (top right: "Connected" / "Reconnecting...")
   - Auto-reconnect with exponential backoff if WebSocket disconnects

3. Polish requirements:
   - Values animate smoothly when updating (number transitions)
   - Cards flash subtly amber/red when a metric crosses threshold
   - Skeleton loading state before first data arrives
   - Responsive: 5 columns on xl, 3 on lg, 2 on md, 1 on sm
   - Add a "Pause updates" toggle button

Include a package.json script to start both the Next.js app and WebSocket server.
```

**After Claude builds it, study these things:**
- [ ] How is the WebSocket connection managed? (open/close lifecycle, cleanup in useEffect)
- [ ] How does reconnection with backoff work?
- [ ] How are the sparkline charts implemented? (data buffer, SVG or canvas)
- [ ] What makes the number transitions smooth? (CSS transitions vs JS animation)

**Key concept**: Real-time UIs require careful cleanup. Every subscription opened in
`useEffect` must be closed in the cleanup function (the return value of useEffect).
This prevents memory leaks — same principle as closing DB connections.

---

## Exercise 8: Capstone — Build Something You Want

**What you'll learn**: Putting it all together, making architectural decisions

Pick one of these (or propose your own):

### Option A: Incident Timeline
```
A tool to document and review incidents:
- Create incident with title, severity, start time
- Add timeline entries (what happened, when, who)
- Tag entries: detection, investigation, mitigation, resolution
- Generate a timeline view (vertical, color-coded by tag)
- Export as markdown
```

### Option B: Config Diff Viewer
```
A tool to compare configuration files:
- Paste or upload two config files (YAML, JSON, TOML)
- Side-by-side diff view with syntax highlighting
- Highlight added, removed, changed keys
- Collapse unchanged sections
- Show a summary: X added, Y removed, Z changed
```

### Option C: Service Dependency Map
```
A visual tool to document service dependencies:
- Add services (name, type, team, health endpoint)
- Draw dependency arrows between services
- Click a service to see its dependencies and dependents
- Color-code by health status (mock data)
- Export as JSON, import to restore
```

**For the capstone, write your OWN prompt using the framework from the main guide:**
1. What am I building + who is it for
2. Tech stack
3. Core user workflow (step by step)
4. Pages/views
5. Data model
6. Design constraints

---

## Progress Tracker

| # | Exercise | Key Concepts | Status |
|---|----------|-------------|--------|
| 1 | Profile Card | Components, props, styling | [ ] |
| 2 | Task Form | State, forms, validation | [ ] |
| 3 | Sortable Table | Data display, sorting, filtering | [ ] |
| 4 | GitHub API | Async, loading states, effects | [ ] |
| 5 | App Shell | Layouts, routing, context, themes | [ ] |
| 6 | CRUD Tasks | Complex state, optimistic UI, hooks | [ ] |
| 7 | Real-time | WebSockets, animations, polish | [ ] |
| 8 | Capstone | Everything, architectural decisions | [ ] |

---

## Tips for Working Through Exercises

1. **Don't just run the prompt and move on.** Read the generated code. Understand every file.
2. **Break things on purpose.** Remove a `useState` call. Delete a `useEffect` cleanup.
   See what happens. This builds intuition faster than reading docs.
3. **Use your browser DevTools.** React DevTools extension shows the component tree and state.
   The Network tab shows API calls. The Elements tab shows computed styles.
4. **After each exercise, ask Claude Code**: "Explain the data flow in this page from user
   interaction to final render" — this reinforces the mental model.
5. **If something looks wrong visually**, describe the problem to Claude Code in terms of
   WHAT IS HAPPENING vs WHAT SHOULD HAPPEN, not in terms of CSS properties.
