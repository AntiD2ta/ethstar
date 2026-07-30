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

// Radii ordered inner → outer. Outer rings have larger circumference so
// they receive proportionally more chips (see `distributeRepos`).
// Split into their own module (rather than exported from saturn-carousel.tsx)
// so the component file only exports the component, keeping Fast Refresh
// working. A drift-detection test asserts MOBILE_RADII stays proportional
// to DESKTOP_RADII (same slice counts are used on both).
export const DESKTOP_RADII = [240, 350, 460, 570] as const;
export const MOBILE_RADII = [100, 145, 190, 235] as const;
