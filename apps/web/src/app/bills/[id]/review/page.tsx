"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { majorToCents } from "@splitbill/shared";
import type { ReceiptDto } from "@splitbill/shared";
import { Docket } from "@/components/docket";
import { Money } from "@/components/money";
import { StepPath } from "@/components/step-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";

type DraftItem = {
  id?: string;
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};

function toDraft(receipt: ReceiptDto): DraftItem[] {
  return receipt.items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: String(item.quantity),
    unitPrice: (item.unitPriceCents / 100).toFixed(2),
    totalPrice: (item.totalPriceCents / 100).toFixed(2),
  }));
}

function safeCents(value: string) {
  try {
    return majorToCents(value || "0");
  } catch {
    return 0;
  }
}

function lineTotal(quantity: string, unitPrice: string) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return unitPrice;
  try {
    return ((qty * majorToCents(unitPrice || "0")) / 100).toFixed(2);
  } catch {
    return unitPrice;
  }
}

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<ReceiptDto | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [subtotal, setSubtotal] = useState("");
  const [serviceCharge, setServiceCharge] = useState("");
  const [tax, setTax] = useState("");
  const [discount, setDiscount] = useState("");
  const [rounding, setRounding] = useState("");
  const [total, setTotal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getReceipt(id)
      .then(({ receipt: data }) => {
        setReceipt(data);
        setItems(toDraft(data));
        setSubtotal(data.subtotalCents != null ? (data.subtotalCents / 100).toFixed(2) : "");
        setServiceCharge(data.serviceChargeCents != null ? (data.serviceChargeCents / 100).toFixed(2) : "");
        setTax(data.taxCents != null ? (data.taxCents / 100).toFixed(2) : "");
        setDiscount(data.discountCents != null ? (data.discountCents / 100).toFixed(2) : "");
        setRounding(data.roundingCents != null ? (data.roundingCents / 100).toFixed(2) : "");
        setTotal(data.totalCents != null ? (data.totalCents / 100).toFixed(2) : "");
      })
      .catch(() => setError("Could not load this receipt."));
  }, [id]);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        if (patch.quantity != null || patch.unitPrice != null) {
          next.totalPrice = lineTotal(next.quantity, next.unitPrice);
        }
        return next;
      }),
    );
  }

  async function onContinue() {
    setBusy(true);
    setError(null);
    try {
      await api.updateReceipt(id, {
        status: "REVIEW",
        subtotalCents: subtotal ? majorToCents(subtotal) : null,
        serviceChargeCents: serviceCharge ? majorToCents(serviceCharge) : null,
        taxCents: tax ? majorToCents(tax) : null,
        discountCents: discount ? majorToCents(discount) : null,
        roundingCents: rounding ? majorToCents(rounding) : null,
        totalCents: total ? majorToCents(total) : null,
        items: items
          .filter((item) => item.name.trim())
          .map((item) => ({
            name: item.name.trim(),
            quantity: Number(item.quantity),
            unitPriceCents: majorToCents(item.unitPrice || "0"),
            totalPriceCents: majorToCents(item.totalPrice || "0"),
          })),
      });
      window.location.href = `/bills/${id}/collect`;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the receipt.");
      setBusy(false);
    }
  }

  if (!receipt) {
    return (
      <Docket>
        <StepPath current="Review" billId={id} />
        <p className="text-mute">{error ?? "Reading the slip…"}</p>
      </Docket>
    );
  }

  return (
    <Docket
      footer={
        <div>
          <Button type="button" disabled={busy} onClick={() => void onContinue()}>
            Looks right — walk up to someone
          </Button>
          <p className="mt-2.5 text-center text-[13px] text-mute">
            Service charge and tax get spread across everyone automatically.
          </p>
        </div>
      }
    >
      <StepPath current="Review" billId={id} />
      <h1 className="text-[34px] leading-[1.08] font-semibold tracking-[-0.03em]">Did we read it right?</h1>
      <p className="mt-2 text-[15px] leading-snug text-mute">Tap any line to fix a name, a quantity or a price.</p>

      {receipt.validationIssues.length > 0 ? (
        <div className="mt-4 rounded-[10px] bg-inset p-3.5 text-sm leading-snug text-alert">
          {receipt.validationIssues.map((issue) => (
            <p key={`${issue.code}-${issue.path}`}>{issue.message}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex justify-between px-0.5 font-mono text-[11px] text-mute">
        <span>Item</span>
        <span>Qty × unit · line</span>
      </div>
      <div className="mt-1.5 flex flex-col">
        {items.map((item, index) => (
          <div key={item.id ?? index} className="border-t border-dashed border-perf px-0.5 py-[13px]">
            <div className="flex items-baseline gap-2">
              <Input
                value={item.name}
                aria-label="Item name"
                onChange={(e) => updateItem(index, { name: e.target.value })}
                className="min-h-0 flex-1 rounded-none bg-transparent px-0 py-0 text-[17px] font-medium"
              />
              <span className="leader" />
              <Money cents={safeCents(item.totalPrice)} currency={receipt.currency} className="text-[17px]" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input
                inputMode="numeric"
                aria-label="Quantity"
                value={item.quantity}
                onChange={(e) => updateItem(index, { quantity: e.target.value })}
                className="min-h-10 min-w-[52px] rounded-lg bg-inset px-2.5 text-center font-mono text-[15px] tabular-nums"
              />
              <span className="text-sm text-mute">×</span>
              <Input
                inputMode="decimal"
                aria-label="Unit price"
                value={item.unitPrice}
                onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                className="min-h-10 w-24 rounded-lg bg-inset px-3 font-mono text-[15px] tabular-nums"
              />
              <span className="flex-1" />
              <button
                type="button"
                className="min-h-10 bg-transparent px-2.5 font-sans text-[13px] text-mute underline"
                onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <div className="border-t border-dashed border-perf" />
      </div>

      <Button
        type="button"
        variant="quiet"
        className="mt-3"
        onClick={() => setItems((current) => [...current, { name: "", quantity: "1", unitPrice: "", totalPrice: "" }])}
      >
        Add a line we missed
      </Button>

      <p className="mt-6 font-mono text-[11px] text-mute">The rest of the slip</p>
      <div className="mt-2 flex flex-col gap-[9px] text-[15px]">
        <SlipField label="Subtotal" value={subtotal} onChange={setSubtotal} />
        <SlipField label="Service charge" value={serviceCharge} onChange={setServiceCharge} />
        <SlipField label="Tax" value={tax} onChange={setTax} />
        <SlipField label="Discount" value={discount} onChange={setDiscount} />
        <SlipField label="Rounding" value={rounding} onChange={setRounding} />
        <div className="mt-1 flex items-baseline gap-2 border-t border-dashed border-perf pt-3">
          <span className="font-semibold">Total</span>
          <span className="leader" />
          {total ? (
            <Input
              inputMode="decimal"
              aria-label="Total"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="min-h-10 w-28 rounded-lg bg-inset px-3 text-right font-mono text-xl font-medium tabular-nums"
            />
          ) : (
            <Money cents={0} className="text-xl" />
          )}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-alert">{error}</p> : null}
    </Docket>
  );
}

function SlipField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-baseline gap-2">
      <span className="text-mute">{label}</span>
      <span className="leader" />
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-10 w-[88px] rounded-lg bg-inset px-3 font-mono text-[15px] tabular-nums"
      />
    </label>
  );
}
