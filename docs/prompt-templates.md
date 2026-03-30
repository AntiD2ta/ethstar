# React Frontend Prompt Templates for Claude Code

> Copy, fill in the brackets, and use these prompts to get high-quality results.
> Each template encodes the patterns that produce the best output.

---

## Template 1: New Project Scaffold

```
Create a new Next.js 14 project in ./[project-name] with:
- App Router, TypeScript (strict mode)
- Tailwind CSS
- shadcn/ui with "[new-york/default]" style and "[slate/zinc/neutral]" base color
- Add these shadcn components: [list the components you'll need]
- [Any additional packages: next-themes, lucide-react icons, etc.]
- Clean home page with [brief description]
- [If needed: basic layout with sidebar/topbar]
```

---

## Template 2: New Page

```
Create a page at /[route] in the [project-name] project.

Purpose: [What is this page for? What problem does it solve?]

User workflow:
1. User arrives and sees [initial state]
2. User [action] → [result]
3. User [action] → [result]
4. [Continue until the workflow is complete]

Data:
- [List the data this page needs]
- [Where it comes from: API, localStorage, props, mock]

Layout:
- [Top section: what's there]
- [Main section: what's there]
- [Sidebar/bottom: if applicable]

Use these shadcn components: [list specific ones]

States to handle:
- Loading: [what to show]
- Empty: [what to show when no data]
- Error: [what to show on failure]
```

---

## Template 3: New Component

```
Create a [ComponentName] component at components/[path].tsx

Props:
- [propName]: [type] — [purpose]
- [propName]: [type] (optional) — [purpose, default value]

Behavior:
- [What happens on render]
- [What happens on interaction]
- [Any conditional rendering]

Visual:
- [Size/layout description]
- [Key visual elements]
- Based on shadcn [Card/Dialog/etc.] component

Usage example: [Show how you expect to use it]
```

---

## Template 4: Add Feature to Existing Page

```
On the /[route] page, add [feature name]:

Current behavior:
[What the page does now]

New behavior:
[What it should do after this change]

Specific requirements:
1. [Requirement with acceptance criteria]
2. [Requirement with acceptance criteria]
3. [Requirement with acceptance criteria]

Do not change: [anything that should stay the same]
```

---

## Template 5: Fix Visual/UX Issue

```
On the /[route] page, [component/area] has this issue:

What's happening: [Describe what you see]
What should happen: [Describe the desired result]

[Optional: screenshot path if you have one]

Constraints:
- Keep the existing layout structure
- [Any other constraints]
```

---

## Template 6: API Integration

```
Connect the /[route] page to [API name]:

Endpoint: [URL or description]
Method: [GET/POST/etc.]
Auth: [How to authenticate — token, API key, none]
Request: [What to send]
Response shape: [TypeScript type or example JSON]

UI behavior:
- Trigger: [What triggers the API call — page load, button click, form submit]
- Loading: [Show skeleton/spinner/disable button]
- Success: [What to display with the data]
- Error: [Show error message with retry]
- [Optional: caching strategy, polling interval, optimistic updates]

Store the API configuration in [.env.local / config file / hardcoded for now].
```

---

## Template 7: Data Table Page

```
Create a data table page at /[route] for [entity name]:

Columns:
| Column | Type | Sortable | Filterable | Format |
|--------|------|----------|------------|--------|
| [name] | [type] | [yes/no] | [yes/no] | [how to display] |

Features:
- [ ] Column sorting (click headers)
- [ ] Text search (which columns)
- [ ] Filter dropdowns (which columns)
- [ ] Pagination ([X] items per page)
- [ ] Row selection (checkbox column)
- [ ] Row click action: [what happens]
- [ ] Bulk actions: [list them]

Data source: [API endpoint / mock data / localStorage]

Empty state: [What to show when no data matches]
```

---

## Template 8: Form Page

```
Create a form at /[route] for [purpose]:

Fields:
| Field | Type | Required | Validation | Default |
|-------|------|----------|------------|---------|
| [name] | [input/select/textarea/date/etc.] | [yes/no] | [rules] | [value] |

Behavior:
- Validate on: [blur / change / submit]
- Show errors: [inline below field / toast / summary at top]
- On submit: [API call / localStorage / console.log]
- After success: [redirect / reset / show toast]
- Submit button text: "[Create X]" / "[Save changes]"

Layout:
- [Single column / two column / sections with headings]
- [Max width constraint]
- [Cancel button: where does it go]
```

---

## Template 9: Dashboard Layout

```
Create a dashboard at /[route] with these panels:

Layout: [Describe the grid — e.g., "2 stat cards on top, wide chart below,
         narrow list on the right"]

Panels:
1. [Panel name]: [What it shows, data source, chart type if applicable]
2. [Panel name]: [What it shows, data source]
3. [Panel name]: [What it shows, data source]

Data: [Where all the data comes from]

Refresh: [Manual button / auto-poll every X seconds / real-time]

Each panel should have its own loading skeleton.
Time range selector at the top: [last hour, 24h, 7d, 30d]
```

---

## Template 10: UX Review Request

```
Review the /[route] page for UX issues. Check:

1. Visual hierarchy: Is the most important information prominent?
2. Spacing consistency: Are gaps between elements consistent?
3. State coverage: Are loading, error, empty states handled?
4. Feedback: Does every action have visible feedback?
5. Accessibility: Keyboard navigation, labels, contrast
6. Responsive: Does it work on mobile/tablet?

For each issue found, explain what's wrong and fix it.
Show me a summary of changes made.
```

---

## Meta-Template: The Universal Prompt Structure

When none of the above templates fit, use this structure:

```
## Context
[What exists now — the current state]

## Goal
[What should exist after — the desired state]

## Constraints
[What must be preserved, tech requirements, design rules]

## Acceptance Criteria
[How I'll know it's done — specific, testable conditions]
```

---

## Anti-Patterns: Prompts That Produce Bad Results

| Bad Prompt | Why It Fails | Better Version |
|---|---|---|
| "Make it look better" | No criteria for "better" | "Increase spacing between cards to gap-6, add subtle border, use consistent font sizes" |
| "Add a settings page" | No spec for what settings | "Add a settings page with: theme toggle, API key input, notification preferences" |
| "Fix the CSS" | Which CSS? What's wrong? | "The cards on /dashboard overlap on screens below 768px width" |
| "Make it responsive" | Too broad | "The /tasks table should stack to cards on mobile (below md breakpoint)" |
| "Add error handling" | To what? Where? | "Add error handling to the GitHub API fetch: show error alert with message and retry button" |
| "Build a blog" | Zero constraints | Use the full Template 1 + Template 2 structure |
