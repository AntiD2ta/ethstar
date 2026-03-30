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

  return (
    <Canvas
      // "demand" renders a single frame then stops — used for reduced motion
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
