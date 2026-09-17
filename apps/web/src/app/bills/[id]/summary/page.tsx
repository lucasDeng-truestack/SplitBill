"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { BillSummaryDto } from "@splitbill/shared";
import { Docket } from "@/components/docket";
import { Money } from "@/components/money";
import { PersonChip } from "@/components/person-chip";
import { StepPath } from "@/components/step-path";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { firstName } from "@/lib/people";
import { cn } from "@/lib/utils";

export default function SummaryPage() {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<BillSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getSummary(id)
      .then((data) => setSummary(data.summary))
      .catch(() => setError("Could not load the summary."));
  }, [id]);

  async function finish(allowUnassigned: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { summary: data } = await api.complete(id, allowUnassigned);
      setSummary(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not finish this bill.");
    } finally {
      setBusy(false);
    }
  }

  async function assignLeftover(personId: string, itemId: string, quantity: number) {
    setBusy(true);
    setError(null);
    try {
      await api.claim(id, { personId, itemId, quantity });
      const { summary: data } = await api.getSummary(id);
      setSummary(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not claim that item.");
    } finally {
      setBusy(false);
    }
  }

  if (!summary) {
    return (
      <Docket>
        <StepPath current="Summary" billId={id} />
        <p className="text-mute">{error ?? "Adding it up…"}</p>
      </Docket>
    );
  }

  const leftover = summary.unassignedItems[0];
  const done = summary.status === "COMPLETED";

  return (
    <Docket
      footer={
        done ? (
          <p className="text-center text-[13px] text-mute">This bill is done. Pay the counter.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Button type="button" disabled={busy || summary.hasUnassigned} onClick={() => void finish(false)}>
              {summary.hasUnassigned ? "Finish the bill" : "Finish — go pay the counter"}
            </Button>
            {summary.hasUnassigned ? (
              <>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void finish(true)}>
                  Finish without it
                </Button>
                <p className="m-0 text-center text-[13px] leading-snug text-mute">
                  Finish without it leaves{" "}
                  <Money cents={summary.unassignedTotalCents} currency={summary.currency} className="text-[13px] font-medium" /> on
                  you at the counter.
                </p>
                <a href={`/bills/${id}/collect`} className={cn(buttonVariants({ variant: "ghost" }), "justify-center no-underline")}>
                  Go back and claim it
                </a>
              </>
            ) : (
              <p className="m-0 text-center text-[13px] text-mute">
                Service charge, tax and rounding are already in these figures.
              </p>
            )}
          </div>
        )
      }
    >
      <StepPath current="Summary" billId={id} />
      <h1 className="text-[34px] leading-[1.08] font-semibold tracking-[-0.03em]">Here’s what everyone owes you</h1>
      <p className={cn("mt-2 text-[15px]", summary.hasUnassigned || summary.unpaidTotalCents > 0 ? "text-mute" : "text-pandan")}>
        {summary.hasUnassigned
          ? `${summary.people.length} people · something still on the table`
          : summary.unpaidTotalCents > 0
            ? "Some people still haven’t paid you."
            : "You’ve collected. Now pay the counter."}
      </p>

      <div className="mt-[22px] flex flex-col">
        {summary.people.map((person, index) => (
          <div
            key={person.personId}
            className={cn(
              "border-t border-dashed border-perf py-4",
              index === summary.people.length - 1 && "border-b",
            )}
          >
            <div className="flex items-center gap-3">
              <PersonChip name={person.name} size="lg" />
              <span className="flex-1">
                <span className="block text-[19px] font-semibold tracking-[-0.01em]">{person.name}</span>
                {person.paymentMethod ? (
                  <span className="mt-0.5 block font-mono text-[11px] text-amber">
                    {person.paymentMethod === "CASH" ? "cash" : "QR"}
                  </span>
                ) : (
                  <span className="mt-0.5 block font-mono text-[11px] text-mute">not paid yet</span>
                )}
              </span>
              <Money cents={person.amountOwedCents} currency={summary.currency} className="text-[26px] tracking-[-0.01em]" />
            </div>
            <div className="mt-2 flex flex-col gap-1.5 pl-[50px]">
              {person.items.map((item) => (
                <div key={item.itemId} className="flex items-baseline gap-2">
                  <span className="text-sm text-mute">
                    {item.name} ×{item.quantity}
                  </span>
                  <span className="leader" />
                  <Money cents={item.lineTotalCents} currency={summary.currency} className="text-[13px] text-mute" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {summary.hasUnassigned && leftover ? (
        <div className="mt-[18px] rounded-[10px] bg-inset p-4">
          <p className="m-0 text-[15px] leading-snug text-ink">
            <strong className="font-semibold">{leftover.name} hasn’t been claimed</strong> — who had it?
          </p>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-sm text-mute">
              {leftover.name} ×{leftover.remainingQuantity}
            </span>
            <span className="leader" />
            <Money cents={leftover.amountCents} currency={summary.currency} className="text-sm" />
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {summary.people.map((person) => (
              <button
                key={person.personId}
                type="button"
                disabled={busy}
                onClick={() => void assignLeftover(person.personId, leftover.itemId, leftover.remainingQuantity)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-perf bg-docket px-4 text-sm font-medium text-ink hover:border-ink"
              >
                <PersonChip name={person.name} size="sm" />
                {firstName(person.name)} had it
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <dl className="mt-5 flex flex-col gap-[7px] text-sm">
        <Row label="Cash in hand" cents={summary.cashTotalCents} currency={summary.currency} className="text-amber" />
        <Row label="QR in hand" cents={summary.qrTotalCents} currency={summary.currency} className="text-amber" />
        {summary.unpaidTotalCents > 0 ? (
          <Row label="Not paid yet" cents={summary.unpaidTotalCents} currency={summary.currency} className="text-alert" />
        ) : null}
        <Row label="Claimed" cents={summary.assignedTotalCents} currency={summary.currency} />
        <Row
          label="Still unclaimed"
          cents={summary.unassignedTotalCents}
          currency={summary.currency}
          className={summary.hasUnassigned ? "text-alert" : undefined}
        />
        {summary.receiptTotalCents != null ? (
          <Row label="Receipt total" cents={summary.receiptTotalCents} currency={summary.currency} strong />
        ) : null}
      </dl>

      {error ? <p className="mt-4 text-sm text-alert">{error}</p> : null}
    </Docket>
  );
}

function Row({
  label,
  cents,
  currency,
  strong,
  className,
}: {
  label: string;
  cents: number;
  currency: string;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className={cn(strong ? "font-semibold text-ink" : "text-mute")}>{label}</dt>
      <span className="leader" />
      <dd className="m-0">
        <Money cents={cents} currency={currency} className={cn("text-sm", className)} />
      </dd>
    </div>
  );
}
