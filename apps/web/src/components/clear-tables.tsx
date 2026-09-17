"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RECEIPT_RANGE_CLEAR_LABELS, type ReceiptListRange } from "@splitbill/shared";
import { api } from "@/lib/api";

export function ClearTables({ range, count }: { range: ReceiptListRange; count: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (count === 0) return null;

  async function onClear() {
    setBusy(true);
    try {
      await api.clearReceipts(range);
      setConfirming(false);
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="rounded-[10px] bg-inset p-3.5">
        <p className="text-sm font-semibold leading-snug text-alert">Remove these tables?</p>
        <p className="mt-1 text-sm leading-snug text-ink">
          {count === 1 ? "1 table" : `${count} tables`} will be deleted. This can’t be undone.
        </p>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            disabled={busy}
            className="min-h-11 bg-transparent font-sans text-sm font-semibold text-alert underline"
            onClick={() => void onClear()}
          >
            {busy ? "Clearing…" : "Clear them"}
          </button>
          <button
            type="button"
            disabled={busy}
            className="min-h-11 bg-transparent font-sans text-sm text-mute underline"
            onClick={() => setConfirming(false)}
          >
            Keep them
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="min-h-11 bg-transparent font-sans text-[13px] text-mute underline"
      onClick={() => setConfirming(true)}
    >
      {RECEIPT_RANGE_CLEAR_LABELS[range]}
    </button>
  );
}
