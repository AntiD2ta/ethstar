import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ShareButtonProps {
  starredCount: number;
}

// ── Star path helper ──
function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerA = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const innerA = outerA + Math.PI / 5;
    ctx.lineTo(cx + outerR * Math.cos(outerA), cy + outerR * Math.sin(outerA));
    ctx.lineTo(cx + innerR * Math.cos(innerA), cy + innerR * Math.sin(innerA));
  }
  ctx.closePath();
}

/** Renders the share image onto a canvas using the provided logo image. */
function renderShareImage(
  starredCount: number,
  logoSource: HTMLImageElement,
): HTMLCanvasElement {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context");

  // ── Background gradient ──
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d0f1a");
  bg.addColorStop(1, "#141830");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Subtle grid dots (batched into a single path) ──
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.beginPath();
  for (let x = 30; x < W; x += 40) {
    for (let y = 30; y < H; y += 40) {
      ctx.moveTo(x + 1, y);
      ctx.arc(x, y, 1, 0, Math.PI * 2);
    }
  }
  ctx.fill();

  // ── Logo (3D diamond capture) — centered in top portion ──
  const logoSize = 280;
  const logoX = (W - logoSize) / 2;
  const logoY = 20;
  ctx.drawImage(logoSource, logoX, logoY, logoSize, logoSize);

  // ── Line 1: "I starred (⭐) # GitHub repositories" ──
  const line1Y = 350;
  ctx.textBaseline = "middle";
  const mainFont = "bold 44px system-ui, -apple-system, sans-serif";
  ctx.font = mainFont;

  const l1a = "I starred ";
  const l1b = ` ${starredCount} GitHub repositories`;
  const starSize = 36;
  const l1aW = ctx.measureText(l1a).width;
  const l1bW = ctx.measureText(l1b).width;
  const line1W = l1aW + starSize + l1bW;
  const l1Start = (W - line1W) / 2;

  // "I starred " — white
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText(l1a, l1Start, line1Y);

  // Star with neon glow
  const starCx = l1Start + l1aW + starSize / 2;
  const starCy = line1Y;
  const glowR = starSize * 1.6;

  ctx.save();
  const neon = ctx.createRadialGradient(starCx, starCy, 0, starCx, starCy, glowR);
  neon.addColorStop(0, "rgba(253,224,71,0.45)");
  neon.addColorStop(0.4, "rgba(250,204,21,0.18)");
  neon.addColorStop(1, "rgba(250,204,21,0)");
  ctx.fillStyle = neon;
  ctx.beginPath();
  ctx.arc(starCx, starCy, glowR, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "rgba(253,224,71,0.7)";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "#facc15";
  starPath(ctx, starCx, starCy, starSize / 2, starSize / 5);
  ctx.fill();
  ctx.restore();

  // " # GitHub repositories" — white
  ctx.font = mainFont;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText(l1b, l1Start + l1aW + starSize, line1Y);

  // ── Line 2: "of the Ethereum community, supporting many" ──
  ctx.font = "24px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.textAlign = "center";
  ctx.fillText("of the Ethereum community, supporting many", W / 2, line1Y + 50);

  // ── Line 3: "teams and devs on building a decentralized world" ──
  ctx.fillText("teams and devs on building a decentralized world", W / 2, line1Y + 85);

  // ── Progress bar ──
  const barX = 300;
  const barY = line1Y + 120;
  const barW = W - 600;
  const barH = 10;
  const barR = 5;

  // Track
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, barR);
  ctx.fill();

  // Fill (full — always 100% since share only shows when allDone)
  const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  barGrad.addColorStop(0, "#7c5cfc");
  barGrad.addColorStop(1, "#a78bfa");
  ctx.fillStyle = barGrad;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, barR);
  ctx.fill();

  // Bar label
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "16px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${starredCount}/${starredCount} repos starred`, W / 2, barY + 30);

  // ── Footer / branding ──
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "20px system-ui, -apple-system, sans-serif";
  ctx.fillText("ethstar.dev", W / 2, H - 32);

  return canvas;
}

/** Module-level singleton — logo is fetched and decoded exactly once. */
let logoPromise: Promise<HTMLImageElement> | null = null;
function getLogoSingleton(): Promise<HTMLImageElement> {
  if (!logoPromise) {
    logoPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = "/logo-512.png";
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
  }
  return logoPromise;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ethstar-share.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("Image downloaded!");
}

export function ShareButton({ starredCount }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snapshot starredCount at the moment the modal opens — avoids re-rendering
  // the canvas if the count ticks up from a background recheck.
  const snapRef = useRef(starredCount);

  // Generate image when modal opens.
  useEffect(() => {
    if (!open) return;
    snapRef.current = starredCount;
    let cancelled = false;

    getLogoSingleton()
      .then((source) => {
        if (cancelled) return;
        const canvas = renderShareImage(snapRef.current, source);
        canvasRef.current = canvas;
        // Use blob URL instead of data URL to keep image bytes outside JS heap.
        return canvasToBlob(canvas);
      })
      .then((blob) => {
        if (cancelled || !blob) return;
        setPreviewUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not generate share image.");
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- starredCount intentionally excluded; snapshotted on open
  }, [open]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setCopied(false);
      canvasRef.current = null;
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
    }
  // previewUrl is read for cleanup only — no need to re-create the callback on every change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = useCallback(async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await canvasToBlob(canvasRef.current);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      toast.success("Image copied to clipboard!");
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Try downloading instead.");
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await canvasToBlob(canvasRef.current);
      downloadBlob(blob);
    } catch {
      toast.error("Could not generate image.");
    }
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="rounded-full px-8"
        onClick={() => setOpen(true)}
      >
        <Share2 className="size-4" aria-hidden="true" />
        Share
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share your support</DialogTitle>
            <DialogDescription>
              Copy or download this image to share on social media.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-hidden rounded-lg border border-border">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={`I starred ${starredCount} Ethereum repos`}
                className="w-full"
              />
            ) : (
              <div className="flex h-48 items-center justify-center bg-muted text-muted-foreground text-sm">
                Generating preview…
              </div>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={handleDownload} disabled={!previewUrl}>
              <Download className="size-4" aria-hidden="true" />
              Download
            </Button>
            <Button onClick={handleCopy} disabled={!previewUrl}>
              {copied ? (
                <>
                  <Check className="size-4" aria-hidden="true" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="size-4" aria-hidden="true" />
                  Copy Image
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
