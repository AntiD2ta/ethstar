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
import { Button } from "@/components/ui/button";
import { useConsent } from "@/lib/consent-context";

const EFFECTIVE_DATE = "2026-04-13";
const CONTACT_EMAIL = "TODO: operator email";

export default function PrivacyPage() {
  const { openBanner } = useConsent();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <nav className="mb-6 text-sm">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← Back to Ethstar
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: {EFFECTIVE_DATE}
        </p>
      </header>

      <article className="prose prose-invert max-w-none prose-headings:font-heading prose-a:text-primary">
        <h2>1. Who we are</h2>
        <p>
          Ethstar (&quot;the Service&quot;) is a community project that helps
          users discover and star open-source Ethereum repositories on GitHub.
          The controller of any personal data processed through the Service is
          the project maintainer (contact: <code>{CONTACT_EMAIL}</code>).
        </p>

        <h2>2. What we process and why</h2>
        <ul>
          <li>
            <strong>GitHub OAuth (authentication &amp; starring).</strong> When
            you sign in or click &quot;Star all&quot;, we exchange an OAuth
            code with GitHub for an access token. The token is kept in your
            browser (<code>localStorage</code>) and used to call the GitHub
            API on your behalf. We do not transmit or store it on our servers
            beyond the immediate callback exchange.
          </li>
          <li>
            <strong>Anonymous usage analytics (only if you opt in).</strong>{" "}
            With your consent, we load Vercel Web Analytics and Vercel Speed
            Insights. They collect aggregated, anonymised page-view and
            performance signals. They do not use cross-site cookies or track
            you across the web.
          </li>
          <li>
            <strong>Cached repository metadata.</strong> Public GitHub data
            (stars, language, description) is cached in your browser to keep
            the site fast. This data is not personal data.
          </li>
        </ul>

        <h2>3. Legal bases (GDPR / UK GDPR)</h2>
        <ul>
          <li>
            <strong>Consent</strong> (Art. 6(1)(a)): analytics cookies and
            Speed Insights.
          </li>
          <li>
            <strong>Performance of a contract / legitimate interest</strong>
            {" "}
            (Art. 6(1)(b) / (f)): GitHub OAuth and the strictly-necessary
            storage required to keep you signed in and to make starring work.
          </li>
        </ul>

        <h2>4. Who we share data with</h2>
        <ul>
          <li>
            <strong>GitHub, Inc.</strong> — OAuth provider. Required to sign
            you in and star repositories on your behalf.
          </li>
          <li>
            <strong>Vercel Inc.</strong> — hosting provider. Receives HTTP
            requests to serve the site and, if you opt in, receives anonymous
            analytics and Web Vitals.
          </li>
        </ul>
        <p>
          We do not sell, rent or share your personal information with third
          parties for their own marketing. We do not engage in &quot;cross-
          context behavioral advertising&quot; as defined by CPRA.
        </p>

        <h2>5. International transfers</h2>
        <p>
          GitHub and Vercel are US-based. When data is transferred outside the
          EEA/UK, it relies on the Standard Contractual Clauses and equivalent
          safeguards published by those providers.
        </p>

        <h2>6. Retention</h2>
        <ul>
          <li>OAuth state cookie: 10 minutes (CSRF defence).</li>
          <li>
            Auth tokens in <code>localStorage</code>: until you sign out or
            clear your browser storage.
          </li>
          <li>
            Consent record: until you change it or clear it from the cookies
            page / browser storage.
          </li>
          <li>
            Vercel Analytics: aggregated data retained per Vercel&apos;s own
            retention policy.
          </li>
        </ul>

        <h2>7. Your rights</h2>
        <p>Under GDPR / UK GDPR, you have the right to:</p>
        <ul>
          <li>access, rectify, erase, and port your data;</li>
          <li>object to or restrict processing;</li>
          <li>
            withdraw consent at any time (use the{" "}
            <button
              type="button"
              onClick={openBanner}
              className="underline hover:text-foreground"
            >
              Cookie preferences
            </button>{" "}
            button or clear your browser storage);
          </li>
          <li>
            lodge a complaint with a supervisory authority — for the UK the
            Information Commissioner&apos;s Office (ICO,{" "}
            <a
              href="https://ico.org.uk/"
              target="_blank"
              rel="noopener noreferrer"
            >
              ico.org.uk
            </a>
            ), or your local EEA DPA.
          </li>
        </ul>

        <h2>8. California residents (CCPA / CPRA)</h2>
        <p>
          If you are a California resident you have the right to know, delete,
          correct, limit use of sensitive personal information, and opt out of
          sale/sharing. Ethstar does not sell or share personal information as
          defined by CPRA; the &quot;Do Not Sell or Share My Personal
          Information&quot; link on the{" "}
          <Link to="/cookies">cookies page</Link> functions as a universal opt-
          out for analytics. You will not be discriminated against for
          exercising these rights. California &quot;Shine the Light&quot;: we
          do not disclose personal information to third parties for their
          direct-marketing purposes.
        </p>

        <h2>9. Security</h2>
        <p>
          All traffic is served over HTTPS. OAuth state is protected via
          HttpOnly, SameSite=Lax cookies. Tokens are short-lived where issued
          (GitHub classic OAuth tokens do not expire; we nevertheless store
          them only in your browser, never on our servers).
        </p>

        <h2>10. Children</h2>
        <p>
          The Service is not directed to children under 13 (or 16 in the EEA).
          We do not knowingly collect data from children.
        </p>

        <h2>11. Changes</h2>
        <p>
          We may update this policy. The effective date above indicates the
          latest version. Material changes will be announced via the site
          header or release notes.
        </p>

        <h2>12. Contact</h2>
        <p>
          Questions or data-subject requests: <code>{CONTACT_EMAIL}</code>.
        </p>
      </article>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button variant="outline" onClick={openBanner}>
          Change cookie preferences
        </Button>
        <Button variant="outline" asChild>
          <Link to="/cookies">Cookies Policy</Link>
        </Button>
      </div>
    </main>
  );
}
