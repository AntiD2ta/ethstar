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
import { ChevronLeft } from "lucide-react";

// Shared "← Back to Ethstar" breadcrumb for policy + 404 pages. Extracted
// because prior inline variants drifted in spacing, arrow glyph, and focus
// ring — three near-duplicates is one too many. Use at the top-left of any
// page that wants a single consistent return affordance.
export function BackBreadcrumb() {
  return (
    <nav
      aria-label="Breadcrumb"
      data-testid="back-breadcrumb"
      className="mb-6 text-sm"
    >
      <Link
        to="/"
        className="inline-flex items-center gap-1 rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back to Ethstar
      </Link>
    </nav>
  );
}
