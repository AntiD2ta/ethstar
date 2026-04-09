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

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Ethereum-logo diamond — two separate 3D pieces with a V-shaped gap:
 *
 * UPPER SECTION: A full octahedron (6 vertices, 8 triangular faces).
 *   - Top apex → peak
 *   - 4 equator vertices (rotated square) → widest horizontal ridge
 *   - Bottom apex → converges to a point below equator
 *   From the front: 4 visible facets (top-left, top-right lighter;
 *   bottom-left, bottom-right darker — natural from directional lighting
 *   hitting the angled normals differently with flatShading).
 *
 * LOWER SECTION: An inverted 4-sided pyramid (5 vertices, 4+2 faces).
 *   - 4 top vertices at equator width → wide V opening
 *   - Bottom apex → final point
 *   The gap between the upper bottom-apex and lower top-edge
 *   creates the characteristic transparent V-chevron.
 *
 * Both use flatShading so each triangular face gets a distinct shade
 * from directional lighting, matching the canonical logo's faceted look.
 */

function makeOctahedron(
  topY: number,
  eqY: number,
  botY: number,
  halfW: number,
  halfD: number,
) {
  const vertices = new Float32Array([
    0, topY, 0,          // 0: top apex
    halfW, eqY, 0,       // 1: equator right
    0, eqY, halfD,       // 2: equator front
    -halfW, eqY, 0,      // 3: equator left
    0, eqY, -halfD,      // 4: equator back
    0, botY, 0,          // 5: bottom apex
  ]);

  // 8 triangular faces — CCW winding for outward normals
  const indices = [
    // Top 4 faces (above equator)
    0, 2, 1,
    0, 3, 2,
    0, 4, 3,
    0, 1, 4,
    // Bottom 4 faces (below equator — "underside")
    5, 1, 2,
    5, 2, 3,
    5, 3, 4,
    5, 4, 1,
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Lower section: an inverted V — two triangular panels (left + right)
 * meeting at a central vertical ridge. Modelled as a very thin wedge:
 * the front ridge protrudes slightly (+Z) so each panel gets a distinct
 * face normal and catches directional light differently (left lighter,
 * right darker) — exactly like the Ethereum logo.
 *
 * From the front: you see two triangles. During Y-rotation the thin
 * profile is visible as a narrow edge, then the back two panels appear.
 */
function makeInvertedBlade(
  topY: number,
  innerY: number,
  botY: number,
  halfW: number,
) {
  // The "ridge" depth — enough to give each panel a distinct angled normal
  // so flatShading creates the left-light / right-dark contrast.
  const ridge = 0.12;

  const vertices = new Float32Array([
    // Top edge: outer corners at topY, center dips to innerY → V-notch
    -halfW, topY, 0,      // 0: top left (outer)
    0, innerY, 0,         // 1: top center (inner V notch — lower than outer)
    halfW, topY, 0,       // 2: top right (outer)
    // Bottom apex — front ridge protrudes slightly for angled normals
    0, botY, ridge,       // 3: bottom apex front
    0, botY, -ridge,      // 4: bottom apex back
  ]);

  const indices = [
    // Front face: two panels meeting at center-to-apex ridge
    1, 3, 0,   // left panel (front)
    2, 3, 1,   // right panel (front)
    // Back face: mirrored
    0, 4, 1,   // left panel (back)
    1, 4, 2,   // right panel (back)
    // Bottom edge (connects front and back apex)
    0, 3, 4,   // left bottom
    2, 4, 3,   // right bottom
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function useEthDiamondGeometries() {
  return useMemo(() => {
    // Flat profile — wide on X, shallow on Z (like a playing card)
    const halfW = 0.85;
    const halfD = 0.32;

    // Upper octahedron proportions (from Ethereum logo reference):
    //   Equator at ~57% down from top apex (top facets taller than underside)
    const upperTop = 1.4;
    const upperEq = 0.2;
    const upperBot = -0.75;

    // Lower inverted V / chevron — thin V-gap, same width as upper equator.
    // Outer top corners at lowerTop, center dips to lowerInner → V-notch.
    const lowerTop = -0.10;      // outer corner Y
    const lowerInner = -0.95;    // center V-notch
    const lowerBot = -1.45;      // bottom apex

    return {
      upper: makeOctahedron(upperTop, upperEq, upperBot, halfW, halfD),
      lower: makeInvertedBlade(lowerTop, lowerInner, lowerBot, halfW),
    };
  }, []);
}

export function EthereumDiamond({ paused }: { paused: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const upperMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const lowerMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const elapsed = useRef(0);
  const { upper, lower } = useEthDiamondGeometries();

  useFrame((_state, delta) => {
    if (paused || !groupRef.current) return;

    elapsed.current += delta;
    const t = elapsed.current;
    // 20s full revolution
    groupRef.current.rotation.y = (t / 20) * Math.PI * 2;

    // Subtle emissive pulse: 3s cycle
    const pulse = 0.3 + 0.15 * Math.sin((t / 3) * Math.PI * 2);
    if (upperMatRef.current) upperMatRef.current.emissiveIntensity = pulse;
    if (lowerMatRef.current) lowerMatRef.current.emissiveIntensity = pulse * 0.8;
  });

  const sharedProps = {
    metalness: 0.05,
    roughness: 0.25,
    transmission: 0.35,
    thickness: 0.8,
    ior: 1.8,
    transparent: true,
    opacity: 0.9,
    flatShading: true,
  } as const;

  return (
    <group ref={groupRef}>
      {/* Upper octahedron — the main faceted pyramid */}
      <mesh geometry={upper}>
        <meshPhysicalMaterial
          ref={upperMatRef}
          color="#7b8dbd"
          emissive="#627EEA"
          emissiveIntensity={0.3}
          {...sharedProps}
        />
      </mesh>
      {/* Lower inverted pyramid — separated by V-gap */}
      <mesh geometry={lower}>
        <meshPhysicalMaterial
          ref={lowerMatRef}
          color="#6a7aaa"
          emissive="#627EEA"
          emissiveIntensity={0.25}
          {...sharedProps}
        />
      </mesh>
    </group>
  );
}
