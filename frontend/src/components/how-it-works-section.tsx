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

import { memo } from "react";
import { Github, Star, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HowItWorksSectionProps {
  isAuthenticated: boolean;
  onLogin: () => void;
  onViewRepositories: () => void;
}

const STEPS = [
  {
    icon: Github,
    title: "Authenticate",
    description: "Sign in with GitHub via OAuth. We request repo scope to star public repositories on your behalf. Alternately, we make it easy to star them manually.",
  },
  {
    icon: Star,
    title: "Star Repositories",
    description: "One click stars every core Ethereum repo with real-time progress tracking.",
  },
  {
    icon: Heart,
    title: "Support Ethereum",
    description: "Every star strengthens the ecosystem's visibility and signals community support.",
  },
] as const;

export const HowItWorksSection = memo(function HowItWorksSection({
  isAuthenticated,
  onLogin,
  onViewRepositories,
}: HowItWorksSectionProps) {
  return (
    <section aria-labelledby="how-it-works-heading" className="flex min-h-dvh flex-col items-center justify-center gap-10 px-4 py-16 md:px-6">
      <h2 id="how-it-works-heading" className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
        How It Works
      </h2>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="glass glass-hover flex flex-col items-center gap-4 rounded-2xl p-8 text-center transition-colors"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <step.icon className="size-6 text-primary" aria-hidden="true" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Step {i + 1}
            </span>
            <h3 className="font-heading text-xl font-semibold">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>
        ))}
      </div>

      <Button
        onClick={isAuthenticated ? onViewRepositories : onLogin}
        size="lg"
        className="rounded-full bg-primary px-8 py-3 text-primary-foreground hover:bg-primary/90"
      >
        {isAuthenticated ? "View Repositories" : "Get Started"}
      </Button>
    </section>
  );
});
