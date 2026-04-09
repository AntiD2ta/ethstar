import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { GitHubUser } from "@/lib/types";

interface AuthHeaderProps {
  user: GitHubUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function AuthHeader({
  user,
  isAuthenticated,
  isLoading,
  onLogin,
  onLogout,
}: AuthHeaderProps) {
  return (
    <header className="glass sticky top-0 z-50 flex items-center justify-between px-6 py-3">
      <nav aria-label="Site">
        <a
          href="/"
          className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight"
        >
          <img
            src="/logo-128.png"
            alt=""
            width={40}
            height={40}
            fetchPriority="high"
            className="h-10 w-10 rounded-full object-cover"
            aria-hidden="true"
          />
          <span>ethstar</span>
        </a>
      </nav>

      {isLoading ? (
        <div className="flex items-center gap-3" aria-label="Loading account">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      ) : isAuthenticated && user ? (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarImage src={user.avatar_url} alt={user.login} />
            <AvatarFallback>
              {user.login.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-foreground/90">
            {user.name ?? user.login}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="rounded-full"
            aria-label="Sign out"
          >
            <LogOut aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <Button
          onClick={onLogin}
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Connect via GitHub
        </Button>
      )}
    </header>
  );
}
