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

import { useEffect, useRef } from "react";
import {
  SUPERNOVA_FADE_MS,
  SUPERNOVA_PARTICLE_COUNT,
  TRAIL_PARTICLE_CAP,
  TRAIL_PARTICLE_LIFE_MS,
  TRAIL_PARTICLE_SIZE_BASE,
  TRAIL_SPAWN_RATE_PER_SEC,
} from "./constants";
import type { RoamingStarStatus } from "./types";

// Hue stops. 0 = ETH blue, 0.5 = ETH purple, 1 = gold. Interpolated at paint
// time. Module-scope so the effect doesn't re-allocate them per mount.
const HUE_BLUE = { r: 98, g: 126, b: 234 } as const;   // #627EEA
const HUE_PURPLE = { r: 123, g: 63, b: 228 } as const; // #7B3FE4
const HUE_GOLD = { r: 240, g: 195, b: 100 } as const;  // warm gold

function hueColor(hue: number, alpha: number): string {
  let r: number, g: number, b: number;
  if (hue < 0.5) {
    const t = hue * 2;
    r = HUE_BLUE.r + (HUE_PURPLE.r - HUE_BLUE.r) * t;
    g = HUE_BLUE.g + (HUE_PURPLE.g - HUE_BLUE.g) * t;
    b = HUE_BLUE.b + (HUE_PURPLE.b - HUE_BLUE.b) * t;
  } else {
    const t = (hue - 0.5) * 2;
    r = HUE_PURPLE.r + (HUE_GOLD.r - HUE_PURPLE.r) * t;
    g = HUE_PURPLE.g + (HUE_GOLD.g - HUE_PURPLE.g) * t;
    b = HUE_PURPLE.b + (HUE_GOLD.b - HUE_PURPLE.b) * t;
  }
  return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha.toFixed(3)})`;
}

function statusHueBand(status: RoamingStarStatus): [number, number] {
  switch (status) {
    case "disconnected": return [0, 0.25];
    case "ready": return [0.1, 0.55];
    case "in-progress": return [0.25, 0.75];
    case "success": return [0.5, 1.0];
    case "partial-failure": return [0.55, 0.9]; // warmed toward purple-red
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornAt: number;
  lifeMs: number;
  // Hue-band: 0 = blue, 0.5 = purple, 1 = gold. Interpolated at paint time.
  hue: number;
  radius: number;
  kind: "trail" | "burst";
}

type StarPosRef = { current: { x: number; y: number } };

export interface TrailController {
  /** Fire the supernova burst at the star's current position. Returns a Promise
   *  that resolves when the burst has fully faded. */
  triggerSupernova: () => Promise<void>;
  /** Pause trail spawning (used during takeover — we swap trail for orbiting ring). */
  setSpawning: (spawning: boolean) => void;
}

interface UseTrailCanvasOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Live star position ref so the rAF loop reads without React re-renders. */
  starPosRef: StarPosRef;
  /** Ready → blue, in-progress → purple-leaning, partial-failure → warm red-purple. */
  statusRef: React.RefObject<RoamingStarStatus>;
  /** Enable/disable the whole loop. Reduced motion passes false. */
  enabled: boolean;
}

/**
 * Canvas particle trail. One rAF loop owns particle spawn + paint.
 * Compositor-only: the canvas is `position: fixed` and sized to the viewport
 * devicePixelRatio-adjusted. All writes are pixel pushes — no DOM layout.
 */
export function useTrailCanvas({
  canvasRef,
  starPosRef,
  statusRef,
  enabled,
}: UseTrailCanvasOptions): TrailController {
  const particlesRef = useRef<Particle[]>([]);
  const spawningRef = useRef(true);
  const lastSpawnRef = useRef(0);
  // `has` flips to true after the first tick records a position — separate
  // flag so we can mutate `pos` in place every frame instead of allocating.
  const lastPosRef = useRef<{ x: number; y: number; has: boolean }>({
    x: 0,
    y: 0,
    has: false,
  });
  const supernovaResolveRef = useRef<(() => void) | null>(null);
  const dprRef = useRef(1);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Capture the stable ref object so the cleanup closure doesn't reach
    // through `lastPosRef.current` post-unmount (lint hint).
    const lastPos = lastPosRef.current;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      // Hard-reset the transform so repeated resizes (including no-op resizes
      // where logical dimensions stay the same) don't compound scale.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const cap = TRAIL_PARTICLE_CAP;

    let prevTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - prevTs); // clamp after tab-switch
      prevTs = now;

      // Spawn trail particles if moving + spawning enabled.
      const star = starPosRef.current;
      if (spawningRef.current && lastPos.has && particlesRef.current.length < cap) {
        const moved = Math.hypot(star.x - lastPos.x, star.y - lastPos.y);
        lastSpawnRef.current += dt;
        const interval = 1000 / TRAIL_SPAWN_RATE_PER_SEC;
        if (moved > 0.2 && lastSpawnRef.current >= interval) {
          lastSpawnRef.current = 0;
          const [hueMin, hueMax] = statusHueBand(statusRef.current ?? "disconnected");
          const hue = hueMin + Math.random() * (hueMax - hueMin);
          particlesRef.current.push({
            x: star.x + (Math.random() - 0.5) * 4,
            y: star.y + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 0.02,
            vy: (Math.random() - 0.5) * 0.02 + 0.01,
            bornAt: now,
            lifeMs: TRAIL_PARTICLE_LIFE_MS * (0.8 + Math.random() * 0.4),
            hue,
            radius: TRAIL_PARTICLE_SIZE_BASE * (0.8 + Math.random() * 0.6),
            kind: "trail",
          });
        }
      }
      // Mutate in place — no per-frame allocation.
      lastPos.x = star.x;
      lastPos.y = star.y;
      lastPos.has = true;

      // Paint.
      ctx.clearRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
      const particles = particlesRef.current;
      const keep: Particle[] = [];
      let burstAlive = false;
      for (const p of particles) {
        const age = now - p.bornAt;
        if (age >= p.lifeMs) continue;
        const t = age / p.lifeMs;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const alpha = (1 - t) * (p.kind === "burst" ? 0.95 : 0.55);
        ctx.fillStyle = hueColor(p.hue, alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (1 - t * 0.4), 0, Math.PI * 2);
        ctx.fill();
        keep.push(p);
        if (p.kind === "burst") burstAlive = true;
      }
      particlesRef.current = keep;

      // Resolve supernova promise once its particles have all died.
      if (supernovaResolveRef.current && !burstAlive) {
        const resolve = supernovaResolveRef.current;
        supernovaResolveRef.current = null;
        resolve();
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      particlesRef.current = [];
      lastPos.has = false;
    };
  }, [canvasRef, starPosRef, statusRef, enabled]);

  const triggerSupernova = (): Promise<void> => {
    return new Promise((resolve) => {
      if (!enabled) {
        // Reduced-motion / disabled: resolve immediately so completion still advances.
        resolve();
        return;
      }
      const star = starPosRef.current;
      const now = performance.now();
      for (let i = 0; i < SUPERNOVA_PARTICLE_COUNT; i++) {
        const angle = (i / SUPERNOVA_PARTICLE_COUNT) * Math.PI * 2;
        const speed = 0.18 + Math.random() * 0.24;
        const hue = Math.random() < 0.5 ? Math.random() * 0.5 : 0.5 + Math.random() * 0.5;
        particlesRef.current.push({
          x: star.x,
          y: star.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          bornAt: now,
          lifeMs: SUPERNOVA_FADE_MS * (0.7 + Math.random() * 0.4),
          hue,
          radius: 2.2 + Math.random() * 1.6,
          kind: "burst",
        });
      }
      supernovaResolveRef.current = resolve;
      // Safety: resolve after max lifetime even if rAF is paused (tab hidden).
      setTimeout(() => {
        if (supernovaResolveRef.current === resolve) {
          supernovaResolveRef.current = null;
          resolve();
        }
      }, SUPERNOVA_FADE_MS * 1.6);
    });
  };

  const setSpawning = (s: boolean) => {
    spawningRef.current = s;
  };

  return { triggerSupernova, setSpawning };
}
