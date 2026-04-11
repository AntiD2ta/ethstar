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
    <section
      aria-labelledby="how-it-works-heading"
      className="flex min-h-0 flex-col items-center justify-center gap-6 px-4 py-12 md:min-h-dvh md:gap-10 md:px-6 md:py-16"
    >
      <h2 id="how-it-works-heading" className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
        How It Works
      </h2>

      <div
        className="flex w-full max-w-4xl flex-col gap-3 md:grid md:grid-cols-3 md:gap-6"
      >
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="glass glass-hover flex w-full flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors md:gap-4 md:rounded-2xl md:p-8"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 md:size-12">
              <step.icon className="size-4 text-primary md:size-6" aria-hidden="true" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground md:text-xs">
              Step {i + 1}
            </span>
            <h3 className="font-heading text-base font-semibold md:text-xl">{step.title}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground md:text-sm">
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
