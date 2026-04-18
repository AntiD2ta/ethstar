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

export const MOBILE_SPLIT_THRESHOLD = 20;

export function shouldSplit(repoCount: number, isDesktop: boolean): boolean {
  return !isDesktop && repoCount > MOBILE_SPLIT_THRESHOLD;
}

export function splitInHalf<T>(items: T[]): [T[], T[]] {
  if (items.length < 2) return [items, []];
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}
