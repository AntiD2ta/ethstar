# Consent and analytics

## Versioned consent shape

Store consent as:

```ts
{ version: 1, necessary: true, statistics: boolean, updatedAt: ISO-string }
```

- Shape-validate each field (`typeof`) on load. Return `null` (= re-prompt) on mismatch OR version drift.
- Bumping `version` is the mechanism for forcing a re-prompt when scope changes (e.g., adding a new category).

## GDPR/PECR analytics gating

`@vercel/analytics/react` and `@vercel/speed-insights/react` start loading as soon as the component mounts. Merely conditioning the `<Analytics />` render isn't enough — the module must not ship to users who haven't consented.

Wrap each in `React.lazy` and render only when `consent.statistics === true`:

```tsx
const Analytics = React.lazy(() =>
  import("@vercel/analytics/react").then(m => ({ default: m.Analytics }))
);
```

`React.lazy` requires a `default` export; adapt the named export inside the factory.

## Code layout

- **Split context from provider file.** Put `createContext()` + the `useConsent` hook in `lib/consent-context.ts` (pure), provider in `lib/consent.tsx`. With `react-refresh/only-export-components` on, a single file exporting both a context and a component trips the lint rule. Mirrors the existing `hooks/auth-context.ts` + `hooks/use-auth.tsx` split.
