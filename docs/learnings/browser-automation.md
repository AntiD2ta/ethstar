# Browser automation

## Chrome MCP limitations

- **Screenshots fail on narrow viewports (< ~400px) with absolutely-positioned content.** The extension captures an all-black PNG in the upper portion when no painted rects are visible there. Functional assertions (`elementFromPoint`, `getBoundingClientRect`, `getComputedStyle`) still work — only screenshots are broken.
- **`resize_window` may silently no-op** if the host window can't match the requested size. The tool returns "Successfully resized" but `innerWidth`/`innerHeight` don't change. Always verify via `javascript_tool` after a resize.

## Playwright fallback

For viewport-sensitive screenshots, drop a one-off `*.spec.ts` in `frontend/e2e/`:

```ts
import { test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test("mobile screenshot", async ({ page }) => {
  await page.goto("http://localhost:5173");
  await page.screenshot({ path: "/tmp/mobile.png" });
});
```

Playwright controls viewport independently of the host Chrome window. Delete the temp spec before committing.

## When to use which

- **Chrome MCP**: interactive exploration during development, DOM introspection, validating acceptance criteria.
- **Playwright**: controlled viewports, reproducible screenshots, regression tests, anything CI-bound.
