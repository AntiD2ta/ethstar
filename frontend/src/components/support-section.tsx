import { useState } from "react";
import { Check, Coffee, Copy, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SupportSectionProps {
  sponsorsUrl?: string;
  kofiUrl?: string;
  ethAddress?: string;
}

export function SupportSection({
  sponsorsUrl = "https://github.com/sponsors",
  kofiUrl = "https://ko-fi.com",
  ethAddress = "",
}: SupportSectionProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!ethAddress) return;
    navigator.clipboard
      .writeText(ethAddress)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard unavailable — ignore silently.
      });
  }

  return (
    <section className="flex flex-col items-center gap-4 border-t border-border px-6 py-12 text-center">
      <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Support
      </h2>
      <p className="max-w-xl text-sm text-muted-foreground">
        Thanks for keeping this project alive. Contributions help cover domain
        and infrastructure costs.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" asChild className="rounded-full">
          <a
            href={sponsorsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Sponsors"
          >
            <Heart aria-hidden="true" />
            GitHub Sponsors
          </a>
        </Button>
        <Button variant="outline" asChild className="rounded-full">
          <a
            href={kofiUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ko-fi"
          >
            <Coffee aria-hidden="true" />
            Ko-fi
          </a>
        </Button>
        {ethAddress && (
          <Button
            variant="outline"
            onClick={handleCopy}
            className="rounded-full font-mono text-xs"
            aria-label="Copy Ethereum address"
          >
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? "Copied!" : `${ethAddress.slice(0, 6)}…${ethAddress.slice(-4)}`}
          </Button>
        )}
      </div>
    </section>
  );
}
