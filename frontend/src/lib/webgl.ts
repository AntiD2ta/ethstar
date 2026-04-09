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
