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
