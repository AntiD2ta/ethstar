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

import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useMediaQuery } from "@/hooks/use-media-query";
import { EthereumDiamond } from "./ethereum-diamond";
import { WireframeGlobe } from "./wireframe-globe";
import { SceneLighting } from "./scene-lighting";

/**
 * Full 3D Ethereum scene — Canvas with diamond, globe, lighting, and bloom.
 * Default export so it can be React.lazy()'d from hero-logo.tsx.
 */
export default function EthereumScene() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Chrome may not fire requestAnimationFrame in visible tabs without user
  // interaction or DevTools open (energy optimization). R3F's render loop
  // depends on rAF, so the Canvas never initializes. Dispatching a resize
  // event from setTimeout (which DOES fire) kicks Chrome's rendering pipeline.
  useEffect(() => {
    const t = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <Canvas
      frameloop={reducedMotion ? "demand" : "always"}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 6], fov: 45 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent" }}
    >
      <SceneLighting />
      <EthereumDiamond paused={reducedMotion} />
      <WireframeGlobe paused={reducedMotion} />
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={1.2}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
