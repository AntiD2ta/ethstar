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
  SUPERNOVA_CORE_FLASH_MAX_R,
  SUPERNOVA_EMBER_COUNT,
  SUPERNOVA_FADE_MS,
  SUPERNOVA_PARTICLE_COUNT,
  SUPERNOVA_SHOCKWAVE_MAX_R,
  SUPERNOVA_SPARKLE_COUNT,
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

// Particle kinds. Trail = ambient comet dust. Supernova layers — burst (radial
// rays), ember (slow afterglow), sparkle (crackle), shock (expanding ring),
// flash (central bloom).
type ParticleKind = "trail" | "burst" | "ember" | "sparkle" | "shock" | "flash";

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
  kind: ParticleKind;
  // Optional physics + render modifiers (supernova layers). Trail particles
  // leave these undefined to keep the hot path free of branching overhead.
  delayMs?: number;   // birth delay — particle exists but renders only after
  drag?: number;      // per-ms velocity multiplier (<= 1)
  streak?: number;    // streak length in px (0 = point render)
  twinkle?: boolean;  // sin-based alpha modulation for embers
  maxRadius?: number; // shock/flash: crest radius at life-midpoint or end
}

// White-gold core ink used for the central flash and the hottest streak
// heads. Intentionally brighter-than-hue-ramp so the peak reads as
// incandescent energy rather than just "more blue".
function coreColor(alpha: number): string {
  return `rgba(255, 236, 180, ${alpha.toFixed(3)})`;
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

      // Paint. Two passes so additive blending only applies to supernova
      // layers — the ambient trail stays in source-over so it doesn't
      // oversaturate against the page background.
      ctx.clearRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
      const particles = particlesRef.current;
      const keep: Particle[] = [];
      let burstAlive = false;

      // Pass 1 — trail particles (source-over).
      for (const p of particles) {
        if (p.kind !== "trail") continue;
        const age = now - p.bornAt;
        if (age >= p.lifeMs) continue;
        const t = age / p.lifeMs;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const alpha = (1 - t) * 0.55;
        ctx.fillStyle = hueColor(p.hue, alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (1 - t * 0.4), 0, Math.PI * 2);
        ctx.fill();
        keep.push(p);
      }

      // Pass 2 — supernova layers with additive blend for luminous bloom.
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        if (p.kind === "trail") continue;
        const effectiveAge = now - p.bornAt - (p.delayMs ?? 0);
        // Pending birth — keep alive but don't render yet.
        if (effectiveAge < 0) {
          keep.push(p);
          burstAlive = true;
          continue;
        }
        if (effectiveAge >= p.lifeMs) continue;
        const t = effectiveAge / p.lifeMs;

        // Physics for motion-kinds. Shock + flash are stationary envelopes.
        if (p.kind === "burst" || p.kind === "ember" || p.kind === "sparkle") {
          if (p.drag != null) {
            // Per-ms drag — Math.pow keeps decay stable across variable dt.
            const dragFactor = Math.pow(p.drag, dt);
            p.vx *= dragFactor;
            p.vy *= dragFactor;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }

        switch (p.kind) {
          case "flash": {
            // Central bloom: radius grows fast then decays. Radial gradient
            // from white-gold core to transparent — the "moment of ignition".
            const envelope = Math.sin(Math.min(1, t * 1.4) * Math.PI); // 0→1→0 hump
            const r = (p.maxRadius ?? SUPERNOVA_CORE_FLASH_MAX_R) * (0.35 + 0.65 * envelope);
            const alpha = envelope * 0.9;
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            grad.addColorStop(0, coreColor(alpha));
            grad.addColorStop(0.35, hueColor(0.85, alpha * 0.55));
            grad.addColorStop(1, hueColor(0.65, 0));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case "shock": {
            // Expanding stroked ring. Radius follows an ease-out curve so the
            // crest feels like a wave releasing pressure, not a linear spread.
            const easeOut = 1 - Math.pow(1 - t, 3);
            const r = (p.maxRadius ?? SUPERNOVA_SHOCKWAVE_MAX_R) * easeOut;
            const alpha = Math.pow(1 - t, 2) * 0.75;
            // Thin the stroke as the ring expands — "energy spread over more
            // circumference has less per-radian intensity".
            const lineWidth = Math.max(0.6, (p.radius ?? 3) * (1 - t * 0.7));
            ctx.strokeStyle = hueColor(p.hue, alpha);
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.stroke();
            break;
          }
          case "burst": {
            // Radial ray with a velocity-aligned streak head (hot white-gold
            // core) + cooling hue body. Streak length scales with speed and
            // decays with life so rays start long and sharp, end short and
            // soft — the "bright leading tip, fading tail" of real debris.
            const speed = Math.hypot(p.vx, p.vy);
            const streakLen = (p.streak ?? 12) * speed * (1 - t * 0.6);
            const headAlpha = (1 - t) * 0.95;
            if (streakLen > 0.5) {
              const tailX = p.x - (p.vx / speed) * streakLen;
              const tailY = p.y - (p.vy / speed) * streakLen;
              const grad = ctx.createLinearGradient(tailX, tailY, p.x, p.y);
              grad.addColorStop(0, hueColor(p.hue, 0));
              grad.addColorStop(0.55, hueColor(p.hue, headAlpha * 0.6));
              grad.addColorStop(1, coreColor(headAlpha));
              ctx.strokeStyle = grad;
              ctx.lineCap = "round";
              ctx.lineWidth = Math.max(0.8, p.radius * (1 - t * 0.35));
              ctx.beginPath();
              ctx.moveTo(tailX, tailY);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
            }
            // Bright head dot for a crisp leading edge.
            ctx.fillStyle = coreColor(headAlpha);
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.4, p.radius * (1 - t * 0.5) * 0.9), 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case "ember": {
            // Slow drifting afterglow. Twinkle via sin-modulated alpha gives
            // the "still-burning debris" feel after the main burst passes.
            const twinkle = p.twinkle
              ? 0.6 + 0.4 * Math.sin((now - p.bornAt) * 0.012 + (p.hue * 9))
              : 1;
            const alpha = Math.pow(1 - t, 1.5) * 0.7 * twinkle;
            ctx.fillStyle = hueColor(p.hue, alpha);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * (1 - t * 0.3), 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case "sparkle": {
            // Tiny bright crackle — plus-shape cross for a classic "star
            // glint" silhouette that reads against dark and light backdrops.
            const alpha = Math.sin(Math.min(1, t * 2) * Math.PI) * 0.95;
            const r = p.radius * (0.7 + 0.3 * Math.sin(t * Math.PI));
            ctx.strokeStyle = coreColor(alpha);
            ctx.lineWidth = 0.9;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.x - r * 1.6, p.y);
            ctx.lineTo(p.x + r * 1.6, p.y);
            ctx.moveTo(p.x, p.y - r * 1.6);
            ctx.lineTo(p.x, p.y + r * 1.6);
            ctx.stroke();
            // Warm dot at center.
            ctx.fillStyle = hueColor(0.95, alpha * 0.8);
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
        }

        keep.push(p);
        burstAlive = true;
      }
      // Restore default blend mode so the next frame's trail pass renders
      // correctly.
      ctx.globalCompositeOperation = "source-over";

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
      const cx = star.x;
      const cy = star.y;

      // Layer 1 — core flash. Single short-lived bloom that peaks then decays.
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        bornAt: now,
        lifeMs: 320,
        hue: 0.85,
        radius: 0,
        maxRadius: SUPERNOVA_CORE_FLASH_MAX_R,
        kind: "flash",
      });

      // Layer 2 — shockwave rings. Two staggered rings: a fast inner pulse and
      // a wider, slightly delayed outer wave. Two crests read as "energy
      // released in discrete fronts" which is more dramatic than one.
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        bornAt: now,
        lifeMs: 620,
        hue: 0.7,
        radius: 3,
        maxRadius: SUPERNOVA_SHOCKWAVE_MAX_R * 0.72,
        kind: "shock",
      });
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        bornAt: now,
        lifeMs: 860,
        hue: 0.9,
        radius: 2,
        maxRadius: SUPERNOVA_SHOCKWAVE_MAX_R,
        delayMs: 120,
        kind: "shock",
      });

      // Layer 3 — primary radial burst with streak-trailing heads. Angle is
      // distributed deterministically so rays fan evenly; speed + phase
      // jitter prevents the "clock hand" look of pure uniform spacing.
      for (let i = 0; i < SUPERNOVA_PARTICLE_COUNT; i++) {
        const angle = (i / SUPERNOVA_PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
        // Two speed bands — fast leading front and slightly slower followers —
        // so the burst reads as layered debris, not a single ring.
        const speed = (i % 3 === 0 ? 0.38 : 0.22) + Math.random() * 0.18;
        // Most rays skew warm (gold/purple — the "ignition heat"); a few cool
        // blue rays keep the ETH identity present in the palette.
        const hue = Math.random() < 0.75 ? 0.55 + Math.random() * 0.45 : Math.random() * 0.45;
        particlesRef.current.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          bornAt: now,
          lifeMs: SUPERNOVA_FADE_MS * (0.45 + Math.random() * 0.25),
          hue,
          radius: 1.8 + Math.random() * 1.8,
          streak: 28 + Math.random() * 24,
          drag: 0.995, // gentle slowdown — per-ms factor, not per-frame
          kind: "burst",
        });
      }

      // Layer 4 — slow drifting embers. Long-lived, twinkling, the "still-
      // glowing debris" that lingers after the burst passes. These define
      // the total envelope: their lifeMs is near SUPERNOVA_FADE_MS.
      for (let i = 0; i < SUPERNOVA_EMBER_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.04 + Math.random() * 0.09;
        particlesRef.current.push({
          x: cx + (Math.random() - 0.5) * 6,
          y: cy + (Math.random() - 0.5) * 6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.015, // faint upward buoyancy
          bornAt: now,
          lifeMs: SUPERNOVA_FADE_MS * (0.75 + Math.random() * 0.25),
          hue: 0.6 + Math.random() * 0.4,
          radius: 1.1 + Math.random() * 1.3,
          drag: 0.998,
          twinkle: true,
          delayMs: Math.random() * 180,
          kind: "ember",
        });
      }

      // Layer 5 — crackling sparkles. Small bright plus-shaped glints with
      // staggered births so the edges keep popping for ~half the envelope.
      for (let i = 0; i < SUPERNOVA_SPARKLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 160;
        const speed = 0.02 + Math.random() * 0.05;
        particlesRef.current.push({
          x: cx + Math.cos(angle) * distance,
          y: cy + Math.sin(angle) * distance,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          bornAt: now,
          lifeMs: 280 + Math.random() * 320,
          hue: 0.8 + Math.random() * 0.2,
          radius: 1.0 + Math.random() * 0.8,
          delayMs: Math.random() * (SUPERNOVA_FADE_MS * 0.55),
          kind: "sparkle",
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
