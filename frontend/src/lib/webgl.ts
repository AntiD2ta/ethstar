let _cached: boolean | null = null;

/** Detect WebGL support by probing a throwaway canvas. Result is memoized. */
export function supportsWebGL(): boolean {
  if (_cached !== null) return _cached;
  try {
    const c = document.createElement("canvas");
    _cached = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    _cached = false;
  }
  return _cached;
}
