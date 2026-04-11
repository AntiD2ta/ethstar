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

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Coffee, Copy, Heart, Server, Wallet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ETH_ADDRESS_CHECKSUMMED } from "@/lib/constants";

/** EIP-681 payment URI encoded in the QR code. */
const EIP681_URI = `ethereum:${ETH_ADDRESS_CHECKSUMMED}`;

/** Check for browser wallet. Called at render time for testability (module-scope
 *  const would capture the value at import time, before tests can mock window.ethereum). */
function isWalletAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.ethereum !== "undefined";
}

interface TipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TipDialog({ open, onOpenChange }: TipDialogProps) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walletAvailable = isWalletAvailable();

  // Clear the copied-feedback timer on unmount to avoid setState on unmounted component.
  useEffect(() => () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ETH_ADDRESS_CHECKSUMMED);
      setCopied(true);
      toast.success("Address copied!");
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy address.");
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!window.ethereum) return;
    setSending(true);
    try {
      const result = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const accounts = result as string[];
      if (!Array.isArray(accounts) || accounts.length === 0) {
        toast.error("No accounts found. Please unlock your wallet.");
        return;
      }

      await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: accounts[0], to: ETH_ADDRESS_CHECKSUMMED }],
      });

      toast.success("Transaction submitted! Thank you for your support.");
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 4001) {
        toast.info("Transaction cancelled.");
      } else {
        toast.error("Transaction failed. Please try again.");
      }
    } finally {
      setSending(false);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Send an ETH Tip
          </DialogTitle>
          <DialogDescription className="sr-only">
            Scan the QR code or copy the address to send an ETH tip.
          </DialogDescription>
        </DialogHeader>

        <div className="flex w-full flex-col gap-6 overflow-hidden">
          {/* Section 1: Thank you */}
          <div className="flex flex-col items-center gap-2 text-center">
            <Heart className="size-8 text-pink-400" aria-hidden="true" />
            <p className="text-sm text-foreground/90">
              Thank you so much for considering a tip! This is the first time I
              launch something and this will push me to go for more. Your support
              will make me smile.
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Section 2: Why tips help */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2">
              <Server className="size-4 text-muted-foreground" aria-hidden="true" />
              <Coffee className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm text-muted-foreground">
              Hosting, domains, AI credits, and brain fuel (coffee) cost money.
              Your tips will help a lot to build more valuable projects.
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Section 3: How to send */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Send ETH or ERC-20 on Mainnet
            </p>

            {/* QR code with white background for scanner contrast */}
            <div
              data-testid="tip-qr-code"
              className="mx-auto rounded-lg bg-white p-3"
            >
              <QRCodeSVG
                value={EIP681_URI}
                size={140}
                level="M"
              />
            </div>

            {/* Full checksummed address */}
            <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs">
                {ETH_ADDRESS_CHECKSUMMED}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
                aria-label="Copy address"
              >
                {copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>

            {/* Wallet send button — shown only when browser wallet detected */}
            {walletAvailable && (
              <Button
                onClick={handleSend}
                disabled={sending}
                className="w-full"
                aria-label="Send with wallet"
              >
                <Wallet className="size-4" aria-hidden="true" />
                {sending ? "Confirming in wallet…" : "Send with Wallet"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TipDialog;
