# Saturn carousel

The hero's orbital repo carousel. Four rings rotate independently; chips on each ring counter-rotate so labels stay upright.

## Ring distribution

- Membership is decoupled from categories via `distributeRepos` + `sortReposForDistribution` in `components/saturn-carousel/distribute-repos.ts`.
- The outermost ring absorbs rounding remainder so total chip count is preserved exactly.
- `RING_SLICES` is computed once at module scope from `DESKTOP_RADII`. Mobile reuses the same slice lengths — **keep `MOBILE_RADII` proportional to `DESKTOP_RADII`** or mobile chip density will silently diverge from desktop.

## Tilt axis

- `tiltAxis: "x"` → landscape ellipse (vertical compression by `cos(tilt)`). Desktop uses X.
- `tiltAxis: "y"` → portrait ellipse (horizontal compression). Mobile uses Y so a 235-radius ring becomes ~237×413 (portrait) instead of 413×237 (landscape).
- The chip counter-rotation must match the same axis: `rotateX(-tilt)` for X-tilt rings, `rotateY(-tilt)` for Y-tilt rings. Mismatched axes produce skewed chips.
- The depth factor for the scale/opacity fade flips too: `sin(θ)` for X-tilt (top comes forward), `−cos(θ)` for Y-tilt (left comes forward).

## Mobile animation

- Earlier the animation was gated with `prefersReducedMotion || !isDesktop`, which broke rAF ticks on mobile. Remove `!isDesktop` from the disable predicate. The config reference stays stable because `isDesktop ? CONST_A : CONST_B` returns the same module-level object every render.

## Zoom wrapper quirks

- `react-zoom-pan-pinch`'s scale applies a 2D `transform: scale(...)`, which creates a stacking context and flattens descendant 3D rotations. For mobile 3D rings inside the zoom wrapper, accept the flattened projection — chips still rotate correctly around Z via `rotateZ`+`translateX` math.
- The inner wrapper inside `<TransformComponent>` must carry real dimensions. Pass `wrapperClass="!h-full !w-full"` and `contentClass="!h-full !w-full"`, otherwise it collapses to 0×0 and children are invisible.
- `TransformWrapper` + `centerOnInit` fires `onZoom` synchronously during initial centering. Don't wire `onZoom`/`onPanning` to dismiss UI hints — use `setTimeout` auto-dismiss or `onPinchStart` instead.
- `useState(true)` + StrictMode double-mount still preserves hint visibility — each effect mount clears the previous timer and starts fresh, so the full 4-second hint shows. No extra guard needed.
