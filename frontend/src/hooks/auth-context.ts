import { createContext, useContext } from "react";
import type { GitHubUser } from "@/lib/types";

export interface AuthContextValue {
  user: GitHubUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  /**
   * Attempt to refresh the access token using the stored refresh token.
   * Returns the new access token on success, or null on failure (in which
   * case the user is logged out as a side effect).
   */
  refreshToken: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
