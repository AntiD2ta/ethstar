import { memo, useEffect, useRef, useState } from "react";

/**
 * Renders subtle star particles that span across the boundary between two
 * full-viewport slides. Uses negative margins to overlap into both the
 * preceding and following sections, creating a "stars drifting between
 * slides" effect without disrupting layout.
 */

interface Particle {
  id: number;
  left: string;
  /** Starting vertical position as percentage from the bottom. */
  bottom: string;
  size: number;
  delay: string;
  duration: string;
}

// Pre-compute particle positions — spread across the full width and the
// lower portion of the container so they float upward into the next slide.
const PARTICLES: Particle[] = Array.from({ length: 30 }, (_, i) => {
  const duration = 3 + ((i * 7) % 4);
  return {
    id: i,
    left: `${(i / 30) * 100 + (((i * 7 + 3) % 9) - 4)}%`,
    // Start in the lower 60% so particles visually emerge from the bottom slide
    bottom: `${((i * 13) % 60)}%`,
    size: 4 + ((i * 3) % 5),
    // Negative delay = start mid-animation so particles are already in motion
    // when they first appear (no frozen starting positions).
    delay: `${-((i * 0.7) % duration).toFixed(1)}s`,
    duration: `${duration}s`,
  };
});

export const SlideTransition = memo(function SlideTransition() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none relative z-10 -my-[200px] h-[400px] w-full overflow-visible"
      aria-hidden="true"
    >
      {visible &&
        PARTICLES.map((p) => (
          <span
            key={p.id}
            className="absolute animate-star-float"
            style={{
              left: p.left,
              bottom: p.bottom,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
              background: "var(--primary)",
              borderRadius: "1px",
            }}
          />
        ))}
    </div>
  );
});
