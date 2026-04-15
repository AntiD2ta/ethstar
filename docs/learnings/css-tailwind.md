# CSS and Tailwind v4

## Animation collisions

- **Tailwind v4 `animate-*` utilities collide on the `animation` shorthand.** Multiple `animate-*` classes on one element → only the last wins. Compose into a single custom utility or use inline `style={{ animation: "a, b" }}` (also handle `prefers-reduced-motion`).
- **`tw-animate-css` ships height-animating keyframes** (`accordion-down/up`, `collapsible-down/up`) that animate `height: 0 → auto`. Even unused, these sit in the bundle and trip static detectors that flag "layout-transition: height on all routes". Override with opacity-only equivalents in `index.css` after the `@import "tw-animate-css"`.
- **`animation-play-state` is NOT inherited.** Target the element carrying the animation directly with a descendant selector, not a parent.

## Specificity

- **Data-attribute selectors override plain class selectors.** `data-[orientation=horizontal]:w-full` has higher specificity than plain `w-auto`; `tailwind-merge` doesn't treat them as conflicting since they have different variants. Use the same variant on both sides when you want override, or use `!`-important.

## Focus utilities

- **Tailwind `focus:` compound variants can no-op on programmatic `.focus()`.** For skip-to-content links, hand-write a `.skip-link` CSS rule (off-screen, revealed on `:focus, :focus-visible`) instead of chaining `sr-only focus:not-sr-only`.

## 3D transforms

- **Tilt-axis controls ellipse orientation.** `rotateX(tilt)` → landscape ellipse (vertical compression by `cos(tilt)`). `rotateY(tilt)` → portrait ellipse (horizontal compression). Chip counter-rotation must match the parent's axis.
- **Counter-rotation for tilted rings**: chain `rotateZ(theta) translateX(radius) rotateZ(-theta) rotateX(-tilt) scale(s)`. The second `rotateZ(-theta)` keeps the chip upright; `rotateX(-tilt)` cancels the parent tilt.

## Layout

- **Don't use `invisible` placeholders in centered flex rows.** They take layout space and push `justify-center` content off-center. Accept minor CLS when data arrives instead.
- **`min-h-dvh flex justify-center` on a section wastes ~30% of mobile height** when centering an `h-[70vh]` child. On mobile, drop `min-h-dvh` and let the section size to content with modest padding (`py-6`).
- **`overflow-x-hidden` on the page root for marquee containment**. Prevents `w-max` content from expanding page scrollable width on mobile.
