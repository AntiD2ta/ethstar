import { useCallback, useEffect, useRef } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { repoKey } from "@/lib/repo-key";
import type { Repository, StarStatus } from "@/lib/types";

interface ManualStarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repos: Repository[];
  starStatuses: Record<string, StarStatus>;
  onRecheckRepo: (repo: Repository) => Promise<void>;
}

export function ManualStarModal({
  open,
  onOpenChange,
  repos,
  starStatuses,
  onRecheckRepo,
}: ManualStarModalProps) {
  // Track repos whose GitHub links were clicked so we re-check on focus.
  const clickedReposRef = useRef<Set<string>>(new Set());

  const handleFocus = useCallback(() => {
    const clicked = clickedReposRef.current;
    if (clicked.size === 0) return;
    const toRecheck = repos.filter((r) => clicked.has(repoKey(r)));
    clicked.clear();
    for (const repo of toRecheck) {
      void onRecheckRepo(repo);
    }
  }, [repos, onRecheckRepo]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [open, handleFocus]);

  const handleStarClick = useCallback((repo: Repository) => {
    clickedReposRef.current.add(repoKey(repo));
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="size-5 text-primary" fill="currentColor" strokeWidth={0} aria-hidden="true" />
            Star Repos Manually
          </DialogTitle>
          <DialogDescription>
            Click each repo to open it on GitHub, then click the ⭐ Star button.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto -mx-2 px-2" role="list" aria-label="Repositories">
          <div className="space-y-1">
            {repos.map((repo) => {
              const key = repoKey(repo);
              const status = starStatuses[key];
              const isStarred = status === "starred";
              return (
                <div
                  key={key}
                  role="listitem"
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">
                      {repo.owner}/{repo.name}
                    </span>
                    {repo.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {repo.description}
                      </p>
                    )}
                  </div>
                  {isStarred ? (
                    <span className="shrink-0 p-1">
                      <Star
                        className="size-5 text-yellow-400"
                        fill="currentColor"
                        strokeWidth={0}
                        aria-label={`${repo.owner}/${repo.name} is starred`}
                      />
                    </span>
                  ) : (
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-md p-1 transition-colors hover:bg-muted/50"
                      aria-label={`Star ${repo.owner}/${repo.name} on GitHub`}
                      onClick={() => handleStarClick(repo)}
                    >
                      <Star className="size-5 text-muted-foreground" strokeWidth={1.5} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
