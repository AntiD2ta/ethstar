import { lazy, Suspense, useEffect, useRef } from "react";
import { supportsWebGL } from "@/lib/webgl";

const EthereumScene = lazy(() => import("./hero-logo-3d/ethereum-scene"));

/** Original 2D logo — used as fallback when WebGL is unavailable. */
function FallbackLogo() {
  return (
    <img
      src="/logo.png"
      alt=""
      data-testid="hero-logo"
      className="h-[250px] w-[250px] md:h-[375px] md:w-[375px] lg:h-[500px] lg:w-[500px] object-contain opacity-20 animate-hero-logo"
      style={{ willChange: "filter, transform", transformStyle: "preserve-3d" }}
    />
  );
}

export function HeroLogo() {
  const webgl = supportsWebGL();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Pause the glow-pulse + rotate-3d animation when the hero is off-screen
  // to eliminate filter: drop-shadow() paint work on every frame.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        el.classList.toggle("hero-logo-paused", !entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
      style={{ perspective: "800px" }}
    >
      {webgl ? (
        <div data-testid="hero-logo" className="h-[250px] w-[250px] md:h-[375px] md:w-[375px] lg:h-[500px] lg:w-[500px] opacity-30">
          <Suspense fallback={null}>
            <EthereumScene />
          </Suspense>
        </div>
      ) : (
        <FallbackLogo />
      )}
    </div>
  );
}
