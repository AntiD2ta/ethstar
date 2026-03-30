import type { ReactNode } from "react";
import { Diamond, Server, ShieldCheck, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RepoCategory } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  diamond: Diamond,
  "shield-check": ShieldCheck,
  server: Server,
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
