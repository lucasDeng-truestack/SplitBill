"use client";

import Link from "next/link";
import { useState } from "react";
import { Docket } from "@/components/docket";
import { ReceiptCamera } from "@/components/receipt-camera";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { compressImage } from "@/lib/image";
import { cn } from "@/lib/utils";

export default function NewBillPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function goToReview(receiptId: string) {
    window.location.href = `/bills/${receiptId}/review`;
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const { receipt } = await api.createFromImage(compressed);
      await goToReview(receipt.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn’t read that photo.");
      setBusy(false);
    }
  }

  async function onManual() {
    setBusy(true);
    setError(null);
    try {
      const { receipt } = await api.createManual();
      await goToReview(receipt.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create a blank receipt.");
      setBusy(false);
    }
  }

  return (
    <Docket>
      <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-mute no-underline hover:text-ink">
        ← Home
      </Link>
      <h1 className="mt-2.5 max-w-[18ch] text-[34px] leading-[1.08] font-semibold tracking-[-0.03em]">Photograph the bill</h1>
      <p className="mt-2 max-w-[32ch] text-base leading-snug text-mute">
        Flatten it out, get all the lines in frame. You’ll see the photo before we read it.
      </p>

      <ReceiptCamera busy={busy} onCapture={(file) => void onFile(file)} />

      <div className="mt-3.5 flex flex-col">
        <label className="relative mx-[-8px] flex min-h-12 cursor-pointer items-center justify-between rounded-[10px] px-2 text-[15px] text-ink hover:bg-inset">
          Pick a photo I already took
          <span className="text-mute">→</span>
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={busy}
            onChange={(event) => {
              void onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        <div className="border-t border-dashed border-rule" />
        <button
          type="button"
          disabled={busy}
          onClick={() => void onManual()}
          className="mx-[-8px] flex min-h-12 items-center justify-between rounded-[10px] bg-transparent px-2 text-left font-sans text-[15px] text-ink hover:bg-inset"
        >
          Type the items in myself
          <span className="text-mute">→</span>
        </button>
      </div>

      {error ? (
        <div className="mt-[22px] rounded-[10px] bg-inset p-3.5">
          <p className="text-sm font-semibold leading-snug text-alert">We couldn’t read that photo.</p>
          <p className="mt-1 text-sm leading-snug text-ink">
            {error} Try again with the whole slip in frame, or type the items in — it’s a few lines.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="secondary" className="w-auto min-h-11 px-4 text-sm" onClick={() => setError(null)}>
              Try again
            </Button>
            <button type="button" className={cn(buttonVariants({ variant: "ghost" }), "text-amber")} onClick={() => void onManual()}>
              Type it in
            </button>
          </div>
        </div>
      ) : null}
    </Docket>
  );
}
