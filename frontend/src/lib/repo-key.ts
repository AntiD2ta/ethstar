/** Canonical key for a repository: "owner/name". */
export function repoKey(repo: { owner: string; name: string }): string {
  return `${repo.owner}/${repo.name}`;
}
