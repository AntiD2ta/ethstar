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

// Timing and easing — single source of truth so the whole component moves
// with one personality. Adjust here, not scattered across files.

// Durations (ms). Exits = ~75% of entrances (per impeccable:animate guidance).
// DURATION_PRESS / DURATION_MICRO reserved for future press-feedback / label-fade use.
export const DURATION_PRESS = 120;
export const DURATION_MICRO = 220;
export const DURATION_FLIP_DORMANT_TO_ROAMING = 520;
export const DURATION_FLIP_TO_TAKEOVER = 560;
export const DURATION_SUPERNOVA = 640;

// Easing — avoid bounce/elastic (dated). Use confident deceleration.
export const EASE_OUT_QUART = "cubic-bezier(0.25, 1, 0.5, 1)";
export const EASE_OUT_QUINT = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

// Breathing (dormant state). 3s cycle, scale 1.0 → 1.03.
export const BREATHE_PERIOD_MS = 3000;
export const BREATHE_SCALE_MAX = 1.03;

// Cursor gravity — roaming mode reveals label and leans toward cursor when within radius.
export const CURSOR_GRAVITY_RADIUS_PX = 180;
export const CURSOR_LEAN_FACTOR = 0.12; // 12% of the cursor-delta, clamped.

// Roaming drift. Base speed in viewport-widths per second.
export const DRIFT_VW_PER_SEC = 0.035;
// Precomputed path segments per section (chosen over Perlin for "designed" feel).
// Expressed as cubic-bezier control points in normalized viewport coords [0..1, 0..1].
// Segments are biased toward gutters (x close to 0 or 1) and section transitions (y around 0.5).
export const ROAMING_PATH_SEGMENTS: ReadonlyArray<
  Readonly<{ p0: [number, number]; c1: [number, number]; c2: [number, number]; p1: [number, number] }>
> = [
  { p0: [0.90, 0.18], c1: [0.72, 0.05], c2: [0.30, 0.32], p1: [0.08, 0.50] }, // top-right → left gutter
  { p0: [0.08, 0.50], c1: [0.22, 0.80], c2: [0.65, 0.92], p1: [0.90, 0.80] }, // drop to bottom
  { p0: [0.90, 0.80], c1: [0.95, 0.40], c2: [0.62, 0.10], p1: [0.40, 0.20] }, // arc back up
  { p0: [0.40, 0.20], c1: [0.18, 0.28], c2: [0.05, 0.60], p1: [0.12, 0.85] }, // drift down left
];
export const PATH_SEGMENT_DURATION_MS = 9000;

// Trail — canvas particle system.
// Particle cap scales with hardware concurrency: 2 per core, clamped.
export const TRAIL_PARTICLE_CAP: number = (() => {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? 4 : 4;
  return Math.max(12, Math.min(48, cores * 2));
})();
export const TRAIL_SPAWN_RATE_PER_SEC = 28; // particles per second when the star moves
export const TRAIL_PARTICLE_LIFE_MS = 900;
export const TRAIL_PARTICLE_SIZE_BASE = 1.6; // css px radius

// Supernova — completion burst.
export const SUPERNOVA_PARTICLE_COUNT = 40;
export const SUPERNOVA_FADE_MS = 600;

// Progress takeover — target viewport position (ratios from top-left).
export const TAKEOVER_X_RATIO = 0.5;
export const TAKEOVER_Y_RATIO = 0.45;
export const TAKEOVER_SCALE = 2.4;
export const TAKEOVER_SPIN_PERIOD_MS = 2600;

// Star geometry (viewBox 100x100, 5-point star).
export const STAR_VIEWBOX = "0 0 100 100";
export const STAR_PATH =
  "M50 6 L61.8 37.6 L95.1 40.5 L70 62.6 L77.6 95.1 L50 78.3 L22.4 95.1 L30 62.6 L4.9 40.5 L38.2 37.6 Z";

// Dormant sizing.
export const DORMANT_STAR_SIZE_PX = 56;
// Roaming free-layer sizing (smaller so it feels like a drifting comet, not a giant CTA).
export const ROAMING_STAR_SIZE_PX = 40;

// Session persistence key (matches the ethstar_ prefix convention).
export const DISMISSED_STORAGE_KEY = "ethstar_star_dismissed";
export const DISMISSED_VERSION = 1; // bump to invalidate on schema changes

// Cancel-gesture prototype selector — "button" or "click". Brief defers this
// decision to craft ("try both"). Flip this to A/B in-browser during QA.
export const CANCEL_GESTURE: "button" | "click" = "button";

// Click-on-star gesture confirm window (variant B of the cancel prototype).
// Shared between the timeout reset and the "Click again to cancel" hint text.
export const CANCEL_CONFIRM_TIMEOUT_MS = 1800;
