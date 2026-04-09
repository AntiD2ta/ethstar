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
 * Extract unique vertex positions from a BufferGeometry.
 * IcosahedronGeometry stores duplicated vertices per-face; we de-duplicate
 * so each network node gets exactly one star point.
 */
function uniqueVertices(geo: THREE.BufferGeometry): Float32Array {
  const pos = geo.getAttribute("position");
  const seen = new Set<string>();
  const points: number[] = [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Round to avoid floating-point near-duplicates
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      points.push(x, y, z);
    }
  }

  return new Float32Array(points);
}

/**
 * Geodesic wireframe globe with prominent star points at each network node.
 * Counter-rotates relative to the diamond for visual depth.
 */
export function WireframeGlobe({ paused }: { paused: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);

  const { wireGeo, starGeo } = useMemo(() => {
    const ico = new THREE.IcosahedronGeometry(2.2, 1);
    // Dedicated points geometry with de-duplicated vertices
    const starPositions = uniqueVertices(ico);
    const pts = new THREE.BufferGeometry();
    pts.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    return { wireGeo: ico, starGeo: pts };
  }, []);

  useFrame((_state, delta) => {
    if (paused || !groupRef.current) return;

    elapsed.current += delta;
    const t = elapsed.current;
    groupRef.current.rotation.y = -(t / 25) * Math.PI * 2;
    groupRef.current.rotation.x = 0.15 * Math.sin(t * 0.3);
  });

  return (
    <group ref={groupRef}>
      {/* Wireframe edges — the network connections */}
      <mesh geometry={wireGeo}>
        <meshBasicMaterial
          color="#627EEA"
          wireframe
          transparent
          opacity={0.12}
        />
      </mesh>
      {/* Star points at each network node — large, bright, visible */}
      <points geometry={starGeo}>
        <pointsMaterial
          color="#c8d8ff"
          size={0.12}
          transparent
          opacity={0.9}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
