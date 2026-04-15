# Topic learnings

Narrow rules, incident post-mortems, and debugging notes — organized by topic so CLAUDE.md stays focused on durable, always-relevant guidance.

Read these files *when working on that topic*, not proactively.

## Index

- [gosec.md](gosec.md) — `#nosec` annotation catalog (G101, G117, G124, G704, G706) and when each suppression is legitimate.
- [oauth.md](oauth.md) — GitHub OAuth flows (GitHub App vs classic), popup postMessage flow, state cookies, ephemeral tokens.
- [vercel-kv.md](vercel-kv.md) — REST API command mapping, pipeline writes, `url.PathEscape` on keys.
- [frontend-testing.md](frontend-testing.md) — Vitest setup quirks, mocking philosophy, Playwright selectors, timers + fetch spies.
- [frontend-performance.md](frontend-performance.md) — `React.memo` comparators, WeakMap rAF caching, compositor layers, hoisting side-effects.
- [css-tailwind.md](css-tailwind.md) — Tailwind v4 `animate-*` collisions, 3D transforms + clip-path, focus utilities, animation-play-state.
- [a11y.md](a11y.md) — aria-live containers, `inert` on marquee clones, heading order, Radix Dialog aria-hidden side effect.
- [saturn-carousel.md](saturn-carousel.md) — ring distribution math, tilt axis, mobile sizing, chip counter-rotation.
- [browser-automation.md](browser-automation.md) — Chrome MCP limitations, Playwright fallbacks for screenshots.
- [consent-analytics.md](consent-analytics.md) — Versioned consent shape, Vercel Analytics gating via `React.lazy`.

## Conventions

- One file per topic. Keep each file under ~100 lines.
- Lead each bullet with the rule/fact; follow with the *why* (often an incident or a constraint that isn't visible in the current code).
- When a learning is superseded by tooling (a new lint rule, a CI check), remove it here and add the enforcement to `../tooling-candidates.md` if not already automated.
