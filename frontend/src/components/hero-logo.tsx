// Copyright © 2026 Miguel Tenorio Potrony - AntiD2ta.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { type ComponentType, useEffect, useRef, useState } from "react";
import { onIdle, supportsWebGL } from "@/lib/webgl";

type SceneModule = typeof import("./hero-logo-3d/ethereum-scene");

/** Original 2D logo — doubles as LCP paint + Suspense fallback for the 3D scene. */
function FallbackLogo({ fillParent = false }: { fillParent?: boolean }) {
  return (
    <img
      src="/logo-512.png"
      alt=""
      width={500}
      height={500}
      // The test-id goes on the parent wrapper in the WebGL branch; standalone
      // fallback carries it directly so Playwright can find the hero logo
      // regardless of which branch rendered.
      data-testid={fillParent ? undefined : "hero-logo"}
      className={
        fillParent
          ? "h-full w-full object-contain opacity-20 animate-hero-logo"
          : "h-[250px] w-[250px] md:h-[375px] md:w-[375px] lg:h-[500px] lg:w-[500px] object-contain opacity-20 animate-hero-logo"
      }
      style={{ willChange: "filter, transform" }}
    />
  );
}

export function HeroLogo() {
  const webgl = supportsWebGL();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [Scene, setScene] = useState<ComponentType | null>(null);

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

  // Defer the 3D scene import until the browser is idle. Previously the
  // import() fired at module-load time, which meant the 254 KB (gz) three.js
  // chunk downloaded in parallel with the main bundle and its 40s+ of shader
  // compile / WebGL init executed on the critical path — LCP ended up being
  // the hero <p>, blocked 8s+ behind that work. Now FallbackLogo paints as
  // LCP (the PNG is already cached from <link rel="preload"> in index.html)
  // and the 3D scene cross-fades in once the main thread has cooled off.
  useEffect(() => {
    if (!webgl) return;
    let cancelled = false;
    const cancelIdle = onIdle(() => {
      if (cancelled) return;
      import("./hero-logo-3d/ethereum-scene")
        .then((mod: SceneModule) => {
          if (cancelled) return;
          // Pass the constructor via updater form so React treats it as a
          // component type, not a state-reducer function.
          setScene(() => mod.default);
        })
        .catch(() => {
          // Chunk failed to load (network error, etc). The FallbackLogo is
          // already visible, so there's nothing to recover here — log once
          // in dev and stay on the fallback silently in prod.
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn("hero-logo: 3D scene chunk failed to load; staying on fallback");
          }
        });
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [webgl]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
      style={{ perspective: "800px" }}
    >
      {webgl ? (
        // Sized container — both the FallbackLogo and the Scene stack
        // absolutely inside it, so the wrapper reserves the same box whether
        // the 3D has arrived yet or not (CLS parity).
        <div
          data-testid="hero-logo"
          className="relative h-[250px] w-[250px] md:h-[375px] md:w-[375px] lg:h-[500px] lg:w-[500px] opacity-30"
        >
          <div
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${Scene ? "opacity-0" : "opacity-100"}`}
          >
            <FallbackLogo fillParent />
          </div>
          {Scene && (
            <div className="absolute inset-0 animate-hero-scene-in">
              <Scene />
            </div>
          )}
        </div>
      ) : (
        <FallbackLogo />
      )}
    </div>
  );
}
