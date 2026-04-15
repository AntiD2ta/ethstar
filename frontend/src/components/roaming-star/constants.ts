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

// Label intro — on detachment into roaming mode, the primary label persists
// briefly so a first-time visitor doesn't see a silent floating diamond. On
// hover devices it auto-hides after this window so the comet stays quiet for
// returning users. On touch devices (no cursor gravity to rediscover it) the
// label stays visible — the intro never times out.
export const LABEL_INTRO_MS = 6000;

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

// Supernova — completion burst. Layered for a genuine "wow" moment: a bright
// core flash peaks and decays, two shockwave rings expand outward, primary
// burst rays fly radially with velocity-trailing streaks, slow embers drift
// with a twinkle, and staggered sparkles crackle at the edges. Composited
// with additive blending ("lighter") so overlapping layers bloom luminously
// rather than stacking as flat paint.
//
// The `SUPERNOVA_FADE_MS` envelope bounds the longest-lived ember. The safety-
// net promise resolution is `SUPERNOVA_FADE_MS * 1.6`, so this value must keep
// the total below 2000ms to stay inside the test harness's fake-timer flush
// window (see roaming-star.test.tsx "focus return after supernova").
export const SUPERNOVA_FADE_MS = 1100;
export const SUPERNOVA_PARTICLE_COUNT = 96; // primary radial burst rays
export const SUPERNOVA_EMBER_COUNT = 36;    // slow drifting afterglow
export const SUPERNOVA_SPARKLE_COUNT = 28;  // crackle highlights, staggered
export const SUPERNOVA_SHOCKWAVE_MAX_R = 380; // px reach at ring crest
export const SUPERNOVA_CORE_FLASH_MAX_R = 140; // px, bright central bloom

// Progress takeover — target viewport position (ratios from top-left).
export const TAKEOVER_X_RATIO = 0.5;
export const TAKEOVER_Y_RATIO = 0.45;
export const TAKEOVER_SCALE = 2.4;
export const TAKEOVER_SPIN_PERIOD_MS = 2600;

// Shape geometry (viewBox 100x100).
//
// Canonical Ethereum octahedron — coordinates mirror `css-diamond.tsx` so
// the roaming star reads as the same mark users already see elsewhere in
// the app. Two paths, not one rhombus: an upper kite with shoulder-and-
// waist proportions and a lower chevron with a V-notch.
//
//   Upper kite  : peak(50,2) → R-shoulder(79,42.4) → waist(50,74.5) →
//                 L-shoulder(21,42.4) → close.
//   Lower chevron: L-outer(21,52.6) → V-notch(50,81.2) → R-outer(79,52.6) →
//                  apex(50,98) → close.
//
// The geometry is intentionally *not* vertically symmetric — the authentic
// ETH diamond has a taller upper kite and a shorter lower chevron. To keep
// `fillLevel` optics honest, consumers pass a calibrated value (the "ready"
// state uses 0.42, not 0.5) so the rising gold fill reads as visually half.
export const STAR_VIEWBOX = "0 0 100 100";
export const STAR_PATH_UPPER = "M50 2 L79 42.4 L50 74.5 L21 42.4 Z";
export const STAR_PATH_LOWER = "M21 52.6 L50 81.2 L79 52.6 L50 98 Z";
// Combined path for the clipped gold fill. `fillRule="evenodd"` is not
// needed here — the two sub-paths don't overlap in x/y where ink is drawn.
export const STAR_PATH = `${STAR_PATH_UPPER} ${STAR_PATH_LOWER}`;

// fillLevel for the "ready" / "partial-failure" states on the authentic
// (asymmetric) ETH silhouette. 0.58 maps to clip rect y=42 — the equator
// line — so the gold covers the full lower chevron *and* the upper kite's
// bottom waist up to the widest point. Visually reads as a balanced half.
// Lower values leave the upper kite empty and make the fill feel
// bottom-heavy; higher values push past the equator and no longer look
// "paused at the halfway point".
export const READY_FILL_LEVEL = 0.58;

// Dormant sizing.
export const DORMANT_STAR_SIZE_PX = 56;
// Roaming free-layer sizing (smaller so it feels like a drifting comet, not a giant CTA).
export const ROAMING_STAR_SIZE_PX = 40;

// Session persistence key (matches the ethstar_ prefix convention).
export const DISMISSED_STORAGE_KEY = "ethstar_star_dismissed";
export const DISMISSED_VERSION = 1; // bump to invalidate on schema changes
