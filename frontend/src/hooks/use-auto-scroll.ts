import { useEffect, useRef, type RefObject } from "react";

/**
 * Auto-scrolls a container horizontally using scrollLeft, producing a seamless
 * loop when the content is duplicated. Pauses on hover/focus/touch so the user
 * can manually scroll through the content.
 *
 * Uses scrollLeft (not CSS transform) so user scrolling and auto-scrolling
 * share the same coordinate system — no visual jump when pausing.
 */
export function useAutoScroll(
  containerRef: RefObject<HTMLDivElement | null>,
  /** Pixels per second */
  speed: number,
  enabled: boolean,
) {
  const pausedRef = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    let lastTime = 0;

    function tick(time: number) {
      if (lastTime > 0 && !pausedRef.current) {
        const delta = (time - lastTime) / 1000; // seconds
        el!.scrollLeft += speed * delta;

        // When we've scrolled past the first half (the duplicate), jump back
        // for a seamless loop. scrollWidth / 2 is exactly the original content.
        const half = el!.scrollWidth / 2;
        if (half > 0 && el!.scrollLeft >= half) {
          el!.scrollLeft -= half;
        }
      }
      lastTime = time;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    const pause = () => { pausedRef.current = true; };
    const resume = () => { pausedRef.current = false; };

    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);
    el.addEventListener("focusin", pause);
    el.addEventListener("focusout", resume);
    // Touch: pause while finger is down so user can scroll
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resume, { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
      el.removeEventListener("focusin", pause);
      el.removeEventListener("focusout", resume);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resume);
    };
  }, [containerRef, speed, enabled]);
}
