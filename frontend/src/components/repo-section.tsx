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

import type { ReactNode } from "react";
import { Cpu, Diamond, Radio, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RepoCategory } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  diamond: Diamond,
  cpu: Cpu,
  radio: Radio,
  wrench: Wrench,
};

interface RepoSectionProps {
  name: RepoCategory;
  iconName: string;
  children: ReactNode;
}

export function RepoSection({ name, iconName, children }: RepoSectionProps) {
  const Icon = ICONS[iconName] ?? Diamond;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-3 px-8 md:px-12">
        <Icon
          size={20}
          className="shrink-0 text-primary"
          aria-hidden="true"
        />
        <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
          {name}
        </h2>
        <div
          className="h-px flex-1 bg-gradient-to-r from-border to-transparent"
          aria-hidden="true"
        />
      </div>
      {children}
    </section>
  );
}
