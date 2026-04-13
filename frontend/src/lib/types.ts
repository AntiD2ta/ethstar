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

export interface Repository {
  owner: string;
  name: string;
  description: string;
  category: RepoCategory;
  url: string;
}

export type RepoCategory =
  | "Ethereum Core"
  | "Consensus Clients"
  | "Execution Clients"
  | "Validator Tooling"
  | "DeFi & Smart Contracts";

export type StarStatus =
  | "unknown"
  | "checking"
  | "starred"
  | "unstarred"
  | "starring"
  | "failed";

export interface StarProgress {
  total: number;
  starred: number;
  remaining: number;
  current: string | null;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export interface CategoryMeta {
  name: RepoCategory;
  icon: string;
}
