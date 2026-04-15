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

/**
 * Visual mode — where the star lives and what it's doing.
 *
 *  - dormant    : sits in the hero CTA slot, breathing, inline label.
 *  - roaming    : hero out of view; free-floating drift with trail.
 *  - takeover   : in-progress; center viewport, spinning, gold fill rising.
 *  - supernova  : completion burst; particle system plays out then dismissed.
 *  - dismissed  : hidden for the session (localStorage persisted).
 */
export type RoamingStarMode =
  | "dormant"
  | "roaming"
  | "takeover"
  | "supernova"
  | "dismissed";

/**
 * Auth / progression state — independent of visual mode. Controls the
 * progressive-form fill (outline → half-filled → rising → solid gold).
 */
export type RoamingStarStatus =
  | "disconnected"   // no user or no progress known → outline only, ETH-blue
  | "ready"          // authenticated with unstarred repos → half-filled (gold core)
  | "in-progress"    // starring loop running → gold fill rises with counter
  | "success"        // all starred → fully gold (leads to supernova)
  | "partial-failure"; // some failed → shrinks to half-filled, trail warms

/**
 * OAuth popup lifecycle for the disconnected label. Drives the secondary line
 * of the two-line label: idle → "Sign in with GitHub ↗", pending → "Waiting
 * for GitHub…", blocked → "Popup blocked — click to retry".
 */
export type RoamingStarOAuthStatus = "idle" | "pending" | "blocked";

/**
 * Snapshot the parent pushes down each render. Keeps RoamingStar a controlled
 * component — no internal ownership of auth/progress state.
 */
export interface RoamingStarState {
  status: RoamingStarStatus;
  /** 0..1. Drives gold fill height and trail hue intensity. */
  fillLevel: number;
  /** Human-readable secondary line for the label. */
  counterLabel?: string;
  /** How many repos are still outstanding (for disconnected/ready labels). */
  remaining: number;
  /** For partial-failure label: how many repos couldn't be starred. */
  failedCount?: number;
  /**
   * Popup lifecycle while status is "disconnected". Optional; omitted/undefined
   * is treated as "idle". Drives the dynamic secondary label line per brief.
   */
  oauthStatus?: RoamingStarOAuthStatus;
}
