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
  | "Validator Tooling";

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
