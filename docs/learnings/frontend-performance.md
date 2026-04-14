# Frontend performance

## React memoization

- **`React.memo` + custom `arePropsEqual` comparator** when parent state is shared across many children. Compare only the relevant slice (e.g., statuses for this category) to prevent cross-category re-renders on every state tick.
- **Don't call hooks inside `memo()`-wrapped children for responsive branching**. Call `useMediaQuery` in the parent, pass `isDesktop` as a prop. Child hooks still execute on every render even when the child body is skipped by `memo`.
- **Wrap marquee children in `memo()`**. The marquee renders children twice (original + clone); without `memo`, a status update re-renders ~34 cards per tick.
- **Pre-compute static grouped constants at module scope**. If `useMemo` has `[]` deps and uses only module-level constants, move it to module scope — one allocation per module, not per component mount.
- **Hoist capability checks (e.g., `supportsWebGL()`) to module scope**. WebGL support doesn't change between renders. Doing the check inside a component body allocates a canvas every re-render.

## Compositor and GPU

- **Static `filter: drop-shadow()` on an animated element blocks the compositor.** Move the filter to a parent wrapper; keep the animated child on `will-change: transform` for GPU promotion.
- **`perspective()` inside a keyframe's `transform` forces main-thread work.** Put `perspective` on the parent wrapper; keep keyframes to `rotateY/Z` only.
- **`transform-style: preserve-3d` has no effect with `clip-path` children.** `clip-path` forces a 2D stacking context. Don't combine them.
- **`react-zoom-pan-pinch` scale inside `perspective` flattens 3D children.** TransformComponent's `transform: scale(...)` creates a 2D stacking context. Accept the flattened projection for zoomed content; rotate around Z via `rotateZ`+`translateX` math.
- **Use a fixed `position: fixed; inset: 0; z-index: -1` div for SVG data-URI backgrounds**, not `body`. It tiles one viewport on its own compositor layer.
- **Cache non-compositor property writes in a `WeakMap<Element, value>` inside rAF loops** to skip unchanged writes. Auto-GC'd when the element is removed.
- **Chrome can suppress rAF in visible tabs without user interaction**, hanging R3F's render loop. Fix: dispatch a synthetic resize on mount:
  ```tsx
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 0);
    return () => clearTimeout(t);
  }, []);
  ```

## Loading

- **Font loading**: prefer HTML `<link>` in `index.html` over CSS `@import` for Google Fonts — eliminates a waterfall hop. Add `<link rel="preconnect">` for both font domains.
- **Visible Suspense placeholders can make fast chunks feel slower**. For lazy components that load in <1s, prefer `fallback={null}`.
- **Radix `AvatarImage` defeats native `loading="lazy"`**. It uses `new window.Image()` to preload before rendering the `<img>`. For hundreds of below-the-fold avatars, render a plain `<img loading="lazy" decoding="async" srcSet="...40 1x, ...80 2x">` with manual onLoad/onError state. Keep the Radix `<Avatar>` Root wrapper for styling. Wrap the custom sub-component in `React.memo` — parent re-renders across ~770 instances otherwise.

## Bundle

- **`rollup-plugin-visualizer` behind `process.env.ANALYZE === "true"`**. Run `npm run analyze` to generate an interactive treemap of gzip sizes.

## Auth caching

- **`refreshInFlight` ref prevents concurrent token-refresh calls**. Store the in-flight refresh promise in a ref; concurrent 401 handlers return the same promise instead of issuing duplicate single-use refresh requests.
- **Reset `starStatuses` to `"unknown"` when `token` becomes `null`**, otherwise cards stay stuck on "checking" after logout. Use a `useEffect` on `token`.
