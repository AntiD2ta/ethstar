# Frontend testing

## Vitest

- **Mocking philosophy**: No MSW. Use `vi.spyOn(globalThis, "fetch")` at the HTTP boundary. Above that, `vi.mock("@/lib/github")` with `importOriginal` so real error classes are re-exported and `instanceof` checks still work:
  ```ts
  vi.mock("@/lib/github", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/github")>();
    return { ...actual, fetchFn: spy };
  });
  ```
- **File naming**: `*.test.ts` for pure unit, `*.integration.test.tsx` for hook+context integration. Co-located next to source. Vitest `include` glob is `src/**/*.{test,integration.test}.{ts,tsx}`.
- **Fake timers + fetch spy**: Use `vi.advanceTimersByTimeAsync(ms)` (NOT sync). Attach `expect(...).rejects` BEFORE calling `advanceTimersByTimeAsync` to avoid an unhandled-rejection blip.
- **`window.location.href` spying**: happy-dom's `Location` uses private class members and can't be proxied. Patch just the `href` descriptor via `Object.defineProperty(window.location, "href", { set: spy, get: () => orig })`. Do **not** replace `window.location` wholesale — it breaks react-router's `BrowserRouter`.
- **Module-level singletons break `restoreMocks: true`**: A `let` variable that captures a mocked dependency persists across tests while the mocks reset, leaving stale references. For canvas/Image-heavy components, test dialog behavior (open/close, button states) and verify the rendering in a real browser session instead.

## Playwright

- **CWD must be `frontend/`** for `npx playwright test` — that's where `playwright.config.ts` lives. Running from the repo root silently discovers zero tests.
- **Consent banner blocks role-based queries**. The Radix Dialog consent banner sets `aria-hidden` on siblings on first load, so `page.getByRole(...)` fails. Use `seedConsent(page)` from `e2e/helpers.ts` in a top-level `test.beforeEach`; it writes a valid `ethstar_consent` entry via `page.addInitScript`.
- **`getByText` is case-insensitive substring by default**. For dialogs, prefer `getByRole("heading", { name: "..." })` (exact accessible-name matching). Alternatively pass a `RegExp` or `{ exact: true }`.
- **`getByRole` respects `aria-hidden`** — if a modal is open, headings on the background page are hidden from the a11y tree and `getByRole` fails. Use `page.locator("h1", { hasText: "..." })` to pass through the overlay, or dismiss the modal first.
- **`page.goto` default `waitUntil: "load"` can miss loading states**. Use `waitUntil: "domcontentloaded"` and a 2+s API mock delay to observe brief loading UIs.
- **Clicks inside animated marquees need `force: true`** — continuously-translating containers never satisfy Playwright's "element is stable" check.
- **Use `{ exact: true }` for ambiguous heading names** (e.g., "Support" vs "Support Ethereum"). Use `data-testid` + scoped locators for duplicate elements.
- **Don't call `addInitScript(() => localStorage.clear())` in `beforeEach`** — it fires on every navigation and breaks persistence tests. Playwright already gives each test a fresh browser context.
- **Canvas sizing is noisy**. Compositor timing can shift WebGL canvas dimensions ±80px. Use proportional tolerances (50–200% of expected) rather than tight absolute ranges.
- **E2E popup OAuth mock**: Mock `window.open` in `addInitScript` to intercept `/api/auth/star` and immediately `postMessage` a fake token. Return `{ closed: false, close: () => {} }` so the closed-popup poller doesn't reject early.

## Portable analytics signal

`@vercel/analytics/react` calls `inject()` which sets `window.va`, `window.vaq`, `window.vai`, `window.vam` regardless of mode. For tests, check `window.va !== undefined`. URL-based detection is fragile because dev module URLs differ from prod chunk hashes.
