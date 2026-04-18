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
import { isLowEndDevice, onIdle, prefersReducedMotion, supportsWebGL } from "@/lib/webgl";

type SceneModule = typeof import("./hero-logo-3d/ethereum-scene");

/**
 * Duration of the FallbackLogo → Scene cross-fade. Must match the
 * `hero-scene-in` keyframe duration in frontend/src/index.css — pulling it
 * into a named constant keeps the JS unmount timer and the CSS animation
 * from drifting.
 */
const HERO_CROSSFADE_MS = 700;

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
  // Gate the 3D path on WebGL capability, device headroom, AND the user's
  // reduced-motion preference. Low-end devices (≤4 cores, ≤2 GB, or Save-Data
  // on) skip the import entirely — even deferred to idle, the 254 KB chunk
  // plus WebGL init can dominate boot on Moto-G-class hardware. Reduced-motion
  // users would only see a static first frame (frameloop="demand") after
  // paying the same chunk + shader compile cost, so we skip the download for
  // them too. Those users get the static PNG hero, no cross-fade, no 3D
  // chunk ever downloaded.
  const use3D = supportsWebGL() && !isLowEndDevice() && !prefersReducedMotion();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [Scene, setScene] = useState<ComponentType | null>(null);
  // Keep FallbackLogo in the DOM only while it's visibly cross-fading. Once
  // the 700ms fade completes we unmount it so its `animate-hero-logo`
  // keyframes (glow-pulse + rotate-3d at 60 Hz, filter: drop-shadow()) stop
  // churning the compositor behind an opacity-0 layer.
  const [fallbackMounted, setFallbackMounted] = useState(true);

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
    if (!use3D) return;
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
            console.warn("hero-logo: 3D scene chunk failed to load; staying on fallback");
          }
        });
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [use3D]);

  // Once the Scene arrives, schedule the FallbackLogo unmount to fire after
  // the opacity cross-fade completes. During the HERO_CROSSFADE_MS window
  // fallbackMounted stays true and the wrapper class resolves to opacity-0,
  // so the visible transition is unchanged; after the timer fires the node
  // drops out of the tree and its animations no longer cost compositor work.
  useEffect(() => {
    if (!Scene) return;
    const id = window.setTimeout(() => setFallbackMounted(false), HERO_CROSSFADE_MS);
    return () => window.clearTimeout(id);
  }, [Scene]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
      style={{ perspective: "800px" }}
    >
      {use3D ? (
        // Sized container — both the FallbackLogo and the Scene stack
        // absolutely inside it, so the wrapper reserves the same box whether
        // the 3D has arrived yet or not (CLS parity).
        <div
          data-testid="hero-logo"
          className="relative h-[250px] w-[250px] md:h-[375px] md:w-[375px] lg:h-[500px] lg:w-[500px] opacity-30"
        >
          {fallbackMounted && (
            <div
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${Scene ? "opacity-0" : "opacity-100"}`}
            >
              <FallbackLogo fillParent />
            </div>
          )}
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
