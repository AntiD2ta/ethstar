/**
 * SVG Ethereum diamond — lightweight replacement for EthereumSceneMini.
 * Uses an inline SVG with CSS 3D rotateY for the spinning effect.
 * Zero WebGL overhead; runs on the compositor thread.
 *
 * Shape matches the canonical Ethereum logo silhouette (front view):
 *   Upper kite: peak at top (0,0), equator at widest point, narrows below.
 *     Left half lighter, right half darker (simulates directional light).
 *   Gap: transparent V-slit between upper and lower sections.
 *   Lower chevron: V-notch top, converges to bottom apex.
 *
 * Coordinates derived from EthereumDiamond 3D geometry:
 *   halfW=0.85, upperTop=1.4, upperEq=0.2, upperBot=-0.75
 *   lowerTop=-0.10, lowerInner=-0.95, lowerBot=-1.45
 * Mapped to a 170x285 SVG viewBox (x: ±85 centered, y: 0→285).
 */
export function CssDiamond() {
  // Map 3D coordinates to SVG: x = (val/0.85)*85 + 85, y = (1.4-val)/2.85*285
  // center x = 85, halfW → 0 and 170
  // top apex (0, 1.4) → (85, 0)
  // equator (±0.85, 0.2) → (0, 120) and (170, 120) — but equator at 56% down
  // upper bottom (0, -0.75) → (85, 215)
  // lower outer top (±0.85, -0.10) → (0, 150) and (170, 150)
  // lower inner (0, -0.95) → (85, 235)
  // lower bottom (0, -1.45) → (85, 285)

  return (
    <div className="css-diamond-wrapper">
      <div className="css-diamond-rotate">
        <svg
          viewBox="0 0 170 285"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="css-diamond-svg"
        >
          {/* Upper kite — 4 triangular facets */}
          {/* Top-left: peak → equator-center → equator-left */}
          <polygon points="85,0 85,120 0,120" fill="oklch(0.52 0.10 270 / 85%)" />
          {/* Top-right: peak → equator-right → equator-center */}
          <polygon points="85,0 170,120 85,120" fill="oklch(0.46 0.10 270 / 80%)" />
          {/* Bottom-left: equator-left → equator-center → bottom-center */}
          <polygon points="0,120 85,120 85,215" fill="oklch(0.42 0.11 272 / 80%)" />
          {/* Bottom-right: equator-center → equator-right → bottom-center */}
          <polygon points="85,120 170,120 85,215" fill="oklch(0.36 0.11 272 / 75%)" />

          {/* Lower chevron — separated by transparent gap */}
          {/* Left: outer-top-left → inner-center → bottom-apex */}
          <polygon points="0,150 85,235 85,285" fill="oklch(0.44 0.10 270 / 80%)" />
          {/* Right: inner-center → outer-top-right → bottom-apex */}
          <polygon points="85,235 170,150 85,285" fill="oklch(0.37 0.11 272 / 75%)" />
        </svg>
      </div>
    </div>
  );
}
