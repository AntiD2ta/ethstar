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

import { Link } from "react-router";
import { AuthHeader } from "@/components/auth-header";
import { BackBreadcrumb } from "@/components/back-breadcrumb";
import { SupportSection } from "@/components/support-section";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth-context";

// Renders real AuthHeader + footer so a 404 doesn't feel like a visual dead
// end. The prior 32-line stub had no header, no footer, and a single "Back
// to Ethstar" button — anyone landing here from a shared broken link had no
// context that this was Ethstar at all.
export default function NotFoundPage() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  return (
    <>
      <AuthHeader
        user={user}
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        onLogin={login}
        onLogout={logout}
      />
      <main className="mx-auto flex min-h-[60dvh] max-w-[65ch] flex-col items-center justify-center gap-6 px-4 py-16 text-center sm:px-6">
        <div className="self-start">
          <BackBreadcrumb />
        </div>
        <h1
          data-testid="not-found-title"
          className="font-heading text-6xl font-bold tracking-tight text-primary md:text-8xl"
        >
          404
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          This page doesn&apos;t exist. Head back to the ecosystem and star the
          repos keeping Ethereum open-source.
        </p>
        <Button asChild size="lg" className="rounded-full px-8">
          <Link to="/" data-testid="not-found-cta">
            Browse repos
          </Link>
        </Button>
      </main>
      <SupportSection />
    </>
  );
}
