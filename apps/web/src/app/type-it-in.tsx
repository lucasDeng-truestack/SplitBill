"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function TypeItIn({ label = "type the items in yourself" }: { label?: string }) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const { receipt } = await api.createManual();
      window.location.href = `/bills/${receipt.id}/review`;
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      className="bg-transparent p-0 font-sans text-[13px] font-normal text-amber underline-offset-2 hover:underline disabled:text-mute"
    >
      {busy ? "Opening…" : label}
    </button>
  );
}
