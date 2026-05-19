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
import { BackBreadcrumb } from "@/components/back-breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConsent } from "@/lib/consent-context";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/constants";

interface StorageItem {
  name: string;
  type: "Cookie" | "localStorage" | "Script";
  purpose: string;
  category: "Strictly necessary" | "Statistics";
  retention: string;
  provider: string;
}

const STORAGE_ITEMS: StorageItem[] = [
  {
    name: "oauth_state",
    type: "Cookie",
    purpose: "GitHub OAuth CSRF token (HttpOnly, SameSite=Lax).",
    category: "Strictly necessary",
    retention: "10 minutes",
    provider: "Ethstar",
  },
  {
    name: "ethstar_auth",
    type: "localStorage",
    purpose: "GitHub access/refresh tokens and cached user profile.",
    category: "Strictly necessary",
    retention: "Until sign-out or storage clear",
    provider: "Ethstar",
  },
  {
    name: "ethstar_stats_cache",
    type: "localStorage",
    purpose: "Offline fallback for community stats.",
    category: "Strictly necessary",
    retention: "Until storage clear",
    provider: "Ethstar",
  },
  {
    name: "ethstar_repo_meta",
    type: "localStorage",
    purpose: "1-hour cache of public repo metadata to reduce GitHub API calls.",
    category: "Strictly necessary",
    retention: "1 hour TTL",
    provider: "Ethstar",
  },
  {
    name: "ethstar_pending_stats",
    type: "localStorage",
    purpose: "Retry queue for failed stats POSTs.",
    category: "Strictly necessary",
    retention: "Until next successful flush",
    provider: "Ethstar",
  },
  {
    name: "ethstar_consent",
    type: "localStorage",
    purpose: "Your cookie-preference choice (required for the consent banner to respect your decision).",
    category: "Strictly necessary",
    retention: "Until you change it or clear storage",
    provider: "Ethstar",
  },
  {
    name: "Vercel Analytics",
    type: "Script",
    purpose:
      "Loads from va.vercel-scripts.com and sends aggregated, anonymous page-view beacons to /_vercel/insights. No cross-site cookie; short-lived privacy-preserving hashes server-side.",
    category: "Statistics",
    retention: "Per Vercel policy",
    provider: "Vercel",
  },
  {
    name: "Vercel Speed Insights",
    type: "Script",
    purpose: "Loads from va.vercel-scripts.com and sends Web Vitals (LCP, CLS, INP) beacons to /_vercel/speed-insights. Anonymous, no cross-site cookie.",
    category: "Statistics",
    retention: "Per Vercel policy",
    provider: "Vercel",
  },
];

export default function CookiesPage() {
  const { openBanner } = useConsent();
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <BackBreadcrumb />

      <header className="mb-8 flex flex-col gap-4">
        <div>
          <h1 className="font-heading text-h2 font-bold tracking-tight">
            Cookies Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Effective date: {LEGAL_EFFECTIVE_DATE}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={openBanner} data-testid="cookies-open-preferences">
            Change cookie preferences
          </Button>
        </div>
      </header>

      <article className="prose prose-invert max-w-[65ch] prose-headings:font-heading prose-a:text-primary prose-p:leading-[1.7] prose-li:leading-[1.7]">
        <h2>How we use storage</h2>
        <p>
          Ethstar uses browser cookies and <code>localStorage</code> for two
          purposes: keeping the site working (strictly necessary) and, only
          with your consent, collecting anonymous usage statistics. No
          strictly-necessary items require consent under GDPR / UK PECR reg.
          6; everything else is opt-in.
        </p>

        <h2>Inventory</h2>
      </article>

      <div className="mt-6 rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Retention</TableHead>
              <TableHead>Provider</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STORAGE_ITEMS.map((item) => (
              <TableRow key={item.name}>
                <TableCell className="font-mono text-xs">{item.name}</TableCell>
                <TableCell>{item.type}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell className="max-w-sm text-sm">{item.purpose}</TableCell>
                <TableCell className="text-sm">{item.retention}</TableCell>
                <TableCell>{item.provider}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <article className="prose prose-invert mt-8 max-w-[65ch] prose-headings:font-heading prose-a:text-primary prose-p:leading-[1.7] prose-li:leading-[1.7]">
        <h2>Third-party details</h2>
        <p>
          Vercel Analytics and Speed Insights load from{" "}
          <code>va.vercel-scripts.com</code> and report to endpoints on{" "}
          <code>/_vercel/insights/*</code>. They do not set cross-site cookies;
          Vercel describes their approach in its{" "}
          <a
            href="https://vercel.com/docs/analytics/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            analytics privacy documentation
          </a>
          . If you opt out, no scripts are loaded and no requests are made.
        </p>

        <h2>How to change your mind</h2>
        <p>
          Click the <strong>Change cookie preferences</strong> button above at
          any time. You can also clear your browser&apos;s storage for this
          site, which resets your consent and signs you out.
        </p>

        <h2>California — Do Not Sell or Share</h2>
        <p>
          We do not sell or share personal information as defined by CPRA. If
          you want to opt out of analytics, click{" "}
          <strong>Change cookie preferences</strong> above and turn Statistics
          off (or use Reject all in the banner). We then process no optional
          data about your visit.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about this policy see the{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </article>
    </main>
  );
}
