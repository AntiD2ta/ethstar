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

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { RingFilter } from "@/lib/ring-filter";
import { isDefaultFilter } from "@/lib/ring-filter";
import { CATEGORIES, REPOS_BY_CATEGORY } from "@/lib/repos";
import { repoKey } from "@/lib/repo-key";
import type { RepoCategory, Repository } from "@/lib/types";

interface RingFilterSheetProps {
  filter: RingFilter;
  selectedCount: number;
  totalCount: number;
  /** Authed users can open the sheet; signed-out users see a connect prompt. */
  isAuthenticated: boolean;
  onToggleSection: (section: RepoCategory) => void;
  onToggleRepo: (repo: Repository) => void;
  onReset: () => void;
}

export function RingFilterSheet({
  filter,
  selectedCount,
  totalCount,
  isAuthenticated,
  onToggleSection,
  onToggleRepo,
  onReset,
}: RingFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const isDefault = useMemo(() => isDefaultFilter(filter), [filter]);

  const label = `Showing ${selectedCount} of ${totalCount}`;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
        <span aria-live="polite">{label}</span>
        <span className="text-[11px] opacity-75">
          Connect to customize
        </span>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
        <span aria-live="polite">{label}</span>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto gap-1 px-0 text-xs text-primary"
          >
            Customize
            <ChevronDown aria-hidden="true" className="size-3" />
          </Button>
        </SheetTrigger>
      </div>

      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto"
        aria-describedby="ring-filter-desc"
      >
        <SheetHeader>
          <SheetTitle>Customize your ring</SheetTitle>
          <SheetDescription id="ring-filter-desc">
            Pick which sections the Saturn ring shows. Starring still happens
            on the marquee below.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4 pt-2">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              Sections
            </legend>
            <ul className="grid gap-2 sm:grid-cols-2">
              {CATEGORIES.map((cat) => {
                const id = `ring-filter-section-${cat.name}`;
                const checked = filter.sections.includes(cat.name);
                return (
                  <li key={cat.name} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={() => onToggleSection(cat.name)}
                      aria-label={cat.name}
                    />
                    <label
                      htmlFor={id}
                      className="cursor-pointer text-sm text-foreground"
                    >
                      {cat.name}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({REPOS_BY_CATEGORY[cat.name].length})
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-foreground"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <ChevronDown
                aria-hidden="true"
                className={`size-4 transition-transform ${
                  advancedOpen ? "rotate-180" : ""
                }`}
              />
              Advanced — per-repo picks
            </button>

            {advancedOpen && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {CATEGORIES.map((cat) => (
                  <fieldset
                    key={cat.name}
                    className="rounded-md border border-border/40 p-3"
                  >
                    <legend className="px-1 text-xs uppercase tracking-wide text-muted-foreground">
                      {cat.name}
                    </legend>
                    <ul className="space-y-1">
                      {REPOS_BY_CATEGORY[cat.name].map((repo) => {
                        const key = repoKey(repo);
                        const sectionActive = filter.sections.includes(
                          cat.name,
                        );
                        const excluded = filter.excludedRepos.includes(key);
                        const extra = filter.includedExtras.includes(key);
                        const checked = sectionActive ? !excluded : extra;
                        const id = `ring-filter-repo-${key}`;
                        return (
                          <li
                            key={key}
                            className="flex items-center gap-2 text-xs"
                          >
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={() => onToggleRepo(repo)}
                              aria-label={key}
                            />
                            <label
                              htmlFor={id}
                              className="cursor-pointer font-mono text-[11px] text-foreground"
                            >
                              {key}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>
                ))}
              </div>
            )}
          </div>

          {!isDefault && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
            >
              Reset to default
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
