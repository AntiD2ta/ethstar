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
 * Scene lighting — designed to emphasize the Ethereum diamond's faceted
 * geometry with directional shading (lighter left, darker right).
 *
 * Key light from upper-left-front creates the canonical logo shading pattern
 * where left facets catch more light than right facets. Fill and rim lights
 * prevent any face from going fully black while maintaining contrast.
 */
export function SceneLighting() {
  return (
    <>
      {/* Ambient fill — enough to see all faces, not enough to wash out */}
      <ambientLight intensity={0.35} />
      {/* Key light: upper-left-front — drives the left-light/right-dark facet shading */}
      <directionalLight position={[-3, 4, 5]} intensity={1.4} color="#8a9fd4" />
      {/* Purple rim from lower-right for dual-tone depth */}
      <directionalLight position={[3, -2, 2]} intensity={0.6} color="#7B3FE4" />
      {/* Backlight for edge definition when rotating */}
      <pointLight position={[0, 0, -4]} intensity={0.5} color="#627EEA" />
    </>
  );
}
