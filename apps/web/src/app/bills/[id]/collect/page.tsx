"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney } from "@splitbill/shared";
import type { BillSummaryDto, PaymentMethod, PersonDto, PersonSummaryDto, ReceiptDto, ReceiptItemDto } from "@splitbill/shared";
import { Docket } from "@/components/docket";
import { ItemFind } from "@/components/item-find";
import { Money } from "@/components/money";
import { PaymentFilterControl, PaymentFilterEmpty } from "@/components/payment-filter";
import { PersonChip } from "@/components/person-chip";
import { QuantityStepper } from "@/components/quantity-stepper";
import { StepPath } from "@/components/step-path";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { filterItemsByQuery } from "@/lib/filter-items";
import {
  DEFAULT_PAYMENT_FILTER,
  filterByPayment,
  paymentFilterCounts,
  type PaymentFilter,
  type PaymentStanding,
} from "@/lib/payment-filter";
import { firstName } from "@/lib/people";
import { cn } from "@/lib/utils";

export default function CollectPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<ReceiptDto | null>(null);
  const [summary, setSummary] = useState<BillSummaryDto | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [find, setFind] = useState("");
  const [filter, setFilter] = useState<PaymentFilter>(DEFAULT_PAYMENT_FILTER);
  /** Which of Cash / QR is being saved right now, so that button can say so. */
  const [saving, setSaving] = useState<PaymentMethod | null>(null);
  /** The last payment tap, shown on "Who's next?" so the tap visibly landed. */
  const [recorded, setRecorded] = useState<{ name: string; method: PaymentMethod; paidCents: number | null } | null>(null);

  const refresh = useCallback(async () => {
    const [{ receipt: data }, { summary: nextSummary }] = await Promise.all([
      api.getReceipt(id),
      api.getSummary(id),
    ]);
    setReceipt(data);
    setSummary(nextSummary);
    return { receipt: data, summary: nextSummary };
  }, [id]);

  useEffect(() => {
    refresh()
      .then(({ receipt: data }) => {
        if (data.people.length === 0) {
          setAdding(true);
          return;
        }
        setPersonId((current) => current ?? data.people[data.people.length - 1]?.id ?? null);
      })
      .catch(() => setError("Could not load this bill."));
  }, [refresh]);

  const person = receipt?.people.find((row) => row.id === personId) ?? null;
  const selected = receipt?.items.find((item) => item.id === selectedId) ?? null;
  const personSummary = summary?.people.find((row) => row.personId === personId) ?? null;

  const personItems = useMemo(() => {
    if (!receipt || !person) return [];
    return receipt.assignments
      .filter((assignment) => assignment.personId === person.id)
      .map((assignment) => {
        const item = receipt.items.find((row) => row.id === assignment.itemId);
        return item ? { assignment, item } : null;
      })
      .filter((row): row is { assignment: (typeof receipt.assignments)[number]; item: ReceiptItemDto } => row != null);
  }, [receipt, person]);

  const tableItems = useMemo(
    () => (receipt ? filterItemsByQuery(receipt.items, find) : []),
    [receipt, find],
  );

  const owedCents = personSummary?.amountOwedCents ?? 0;
  const balanceCents = personSummary?.balanceCents ?? 0;
  const canCollect = owedCents > 0 || balanceCents !== 0;

  async function addClaim() {
    if (!person || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.claim(id, { personId: person.id, itemId: selected.id, quantity });
      const { receipt: updated } = await refresh();
      const fresh = updated.items.find((item) => item.id === selected.id);
      if (!fresh || fresh.remainingQuantity <= 0) {
        setSelectedId(null);
        setQuantity(1);
      } else {
        setQuantity(1);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign that item.");
    } finally {
      setBusy(false);
    }
  }

  async function undoClaim(assignmentId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAssignment(id, assignmentId);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not undo that item.");
    } finally {
      setBusy(false);
    }
  }

  async function addPerson() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addPerson(id, { name: name.trim() });
      const { receipt: updated } = await refresh();
      const next = updated.people[updated.people.length - 1];
      setName("");
      setAdding(false);
      setRecorded(null);
      setPersonId(next?.id ?? null);
      setSelectedId(null);
      setQuantity(1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that person.");
    } finally {
      setBusy(false);
    }
  }

  function openPerson(nextId: string) {
    setPersonId(nextId);
    setAdding(false);
    setRecorded(null);
    setSelectedId(null);
    setQuantity(1);
    setFind("");
    setError(null);
  }

  function comeBackLater() {
    setAdding(true);
    setRecorded(null);
    setName("");
    setSelectedId(null);
    setQuantity(1);
    setFind("");
    setError(null);
  }

  async function removePerson() {
    if (!person) return;
    setBusy(true);
    setError(null);
    try {
      await api.deletePerson(id, person.id);
      const { receipt: updated } = await refresh();
      setPersonId(null);
      setSelectedId(null);
      setQuantity(1);
      setAdding(true);
      if (updated.people.length === 0) {
        setName("");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that person.");
    } finally {
      setBusy(false);
    }
  }

  async function collectWith(method: PaymentMethod) {
    if (!person || !canCollect) return;
    setBusy(true);
    setSaving(method);
    setError(null);
    try {
      await api.updatePerson(id, person.id, { paymentMethod: method });
      const { summary: fresh } = await refresh();
      const row = fresh.people.find((seat) => seat.personId === person.id);
      // Every tap lands somewhere visible: back to "Who's next?" with a note of what was recorded.
      // Staying put after a top-up or a cash/QR correction looked like the button had died.
      comeBackLater();
      setRecorded({ name: person.name, method: row?.paymentMethod ?? method, paidCents: row?.paidCents ?? null });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record how they paid.");
    } finally {
      setBusy(false);
      setSaving(null);
    }
  }

  if (!receipt) {
    return (
      <Docket>
        <StepPath current="Collect" billId={id} />
        <p className="text-mute">{error ?? "Loading…"}</p>
      </Docket>
    );
  }

  const remainingUnclaimed = receipt.items.some((item) => item.remainingQuantity > 0);
  const collectedCount = receipt.people.length;
  const unpaidCount = receipt.people.filter((seat) => seat.paymentMethod == null).length;
  const unsettledIds = new Set(summary?.people.filter((row) => row.balanceCents !== 0).map((row) => row.personId));
  const pocketCash = summary?.cashTotalCents ?? 0;
  const pocketQr = summary?.qrTotalCents ?? 0;

  const standingOf = (seat: PersonDto): PaymentStanding => ({
    paymentMethod: seat.paymentMethod,
    balanceCents: summary?.people.find((row) => row.personId === seat.id)?.balanceCents ?? 0,
  });
  const filterCounts = paymentFilterCounts(receipt.people, standingOf);
  const filteredPeople = filterByPayment(receipt.people, standingOf, filter);
  const showFilter = receipt.people.length > 1;
  // The person on screen never disappears from the chips, whatever the filter says.
  const chipPeople = (currentId: string | null) =>
    receipt.people.filter((seat) => seat.id === currentId || filteredPeople.includes(seat));
  const filteredLabel = filter === "paid" ? "Paid so far" : filter === "unpaid" ? "Still to collect" : "Everyone so far";
  const recordedNote = recorded
    ? `${firstName(recorded.name)} paid by ${recorded.method === "CASH" ? "cash" : "QR"}${
        recorded.paidCents != null ? ` · ${formatMoney(recorded.paidCents, receipt.currency)}` : ""
      } — recorded.`
    : null;

  if (adding || !person) {
    return (
      <Docket
        footer={
          collectedCount > 0 ? (
            <div>
              <a href={`/bills/${id}/summary`} className={cn(buttonVariants(), "no-underline")}>
                That’s everyone — pay the counter
              </a>
              <p className="mt-2.5 text-center text-[13px] text-mute">
                {unpaidCount > 0
                  ? `${unpaidCount === 1 ? "1 person" : `${unpaidCount} people`} still unpaid — tap a face to go back.`
                  : unsettledIds.size > 0
                    ? `${unsettledIds.size === 1 ? "1 person’s" : `${unsettledIds.size} people’s`} order changed after they paid — tap a face to settle up.`
                    : remainingUnclaimed
                    ? "Something is still unclaimed — you can sort it out before you pay."
                    : "You’ve got everyone’s money. Go settle the bill."}
              </p>
            </div>
          ) : null
        }
      >
        <StepPath current="Collect" billId={id} />
        {collectedCount > 0 ? (
          <>
            {showFilter ? <PaymentFilterControl value={filter} counts={filterCounts} onChange={setFilter} className="mb-3" /> : null}
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 font-mono text-xs text-amber">
                {collectedCount === 1 ? "1 person so far" : `${collectedCount} people so far`}
              </p>
              <SeatChips people={chipPeople(null)} currentId={null} unsettledIds={unsettledIds} onOpen={openPerson} />
            </div>
            {showFilter && filteredPeople.length === 0 ? (
              <PaymentFilterEmpty filter={filter} onShowAll={() => setFilter("all")} />
            ) : null}
          </>
        ) : null}
        <h1 className="mt-2.5 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em]">
          {collectedCount === 0 ? "Walk up to someone" : "Who’s next?"}
        </h1>
        <p className="mt-2 text-[15px] leading-snug text-mute">
          {collectedCount === 0
            ? "Add their name, tap what they ordered, and take the money before you walk on."
            : "Add the next person, or tap a face to go back to someone you already started with."}
        </p>
        {recordedNote ? (
          <p role="status" className="mt-3 rounded-[10px] bg-inset px-3.5 py-2.5 text-sm text-pandan">
            {recordedNote}
          </p>
        ) : null}
        <form
          className="mt-[22px] flex flex-col gap-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            void addPerson();
          }}
        >
          <Input
            value={name}
            autoFocus
            placeholder="Their name"
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" disabled={busy || !name.trim()}>
            I’m with them
          </Button>
        </form>
        <EveryoneSoFar
          people={filteredPeople}
          summaries={summary?.people ?? []}
          currentId={null}
          label={filteredLabel}
          currency={receipt.currency}
          onOpen={openPerson}
        />
        <PocketLine cash={pocketCash} qr={pocketQr} currency={receipt.currency} />
        {error ? <p className="mt-4 text-sm text-alert">{error}</p> : null}
      </Docket>
    );
  }

  const paidLabel =
    person.paymentMethod === "CASH" ? "Paid by cash" : person.paymentMethod === "QR" ? "Paid by QR" : null;
  const paidCents = personSummary?.paidCents ?? null;

  return (
    <Docket
      footer={
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <span className={cn("text-sm", balanceCents !== 0 ? "font-semibold text-alert" : "text-mute")}>
              {balanceCents > 0
                ? `Collect ${formatMoney(balanceCents, receipt.currency)} more`
                : balanceCents < 0
                  ? `Give back ${formatMoney(-balanceCents, receipt.currency)}`
                  : (paidLabel ?? `Collect from ${firstName(person.name)}`)}
            </span>
            <Money cents={owedCents} currency={receipt.currency} className="text-[22px] text-amber" />
          </div>
          {balanceCents !== 0 && paidCents != null ? (
            <p className="-mt-1.5 mb-3 text-[13px] leading-snug text-mute">
              They paid {formatMoney(paidCents, receipt.currency)}, but their order changed.{" "}
              {balanceCents > 0 ? "Take the rest" : "Give the change back"}, then tap how — Cash or QR.
            </p>
          ) : null}
          {canCollect ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={person.paymentMethod === "CASH" ? "primary" : "secondary"}
                className="flex-1"
                disabled={busy}
                onClick={() => void collectWith("CASH")}
              >
                {saving === "CASH" ? "Saving…" : "Cash"}
              </Button>
              <Button
                type="button"
                variant={person.paymentMethod === "QR" ? "primary" : "secondary"}
                className="flex-1"
                disabled={busy}
                onClick={() => void collectWith("QR")}
              >
                {saving === "QR" ? "Saving…" : "QR"}
              </Button>
            </div>
          ) : (
            // Inert Cash/QR buttons here looked live and felt broken when tapped.
            <p className="m-0 rounded-[10px] bg-inset px-3.5 py-3 text-center text-sm text-mute">
              Tap what {firstName(person.name)} ordered first, then take cash or QR.
            </p>
          )}
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost" }), "mt-1 w-full justify-center")}
            onClick={comeBackLater}
          >
            I’ll come back
          </button>
          <p className="mt-2 text-center text-[13px] text-mute">
            {owedCents <= 0
              ? "You can leave and come back to them."
              : person.paymentMethod
                ? "Change cash or QR if you got it wrong, or come back later."
                : "Take cash or QR, or come back if you’re not done asking."}
          </p>
          {collectedCount > 0 ? (
            <a
              href={`/bills/${id}/summary`}
              className={cn(buttonVariants({ variant: "ghost" }), "mt-1 justify-center no-underline")}
            >
              That’s everyone — pay the counter
            </a>
          ) : null}
        </div>
      }
    >
      <StepPath current="Collect" billId={id} />

      {showFilter ? <PaymentFilterControl value={filter} counts={filterCounts} onChange={setFilter} className="mb-3" /> : null}
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 font-mono text-xs text-amber">
          {collectedCount === 1 ? "1st person" : `Person ${receipt.people.findIndex((seat) => seat.id === person.id) + 1}`}
        </p>
        <SeatChips people={chipPeople(person.id)} currentId={person.id} unsettledIds={unsettledIds} onOpen={openPerson} />
      </div>

      <h1 className="mt-2.5 text-[46px] leading-[1.02] font-semibold tracking-[-0.035em]">{person.name}</h1>
      <p className="mt-1.5 text-base leading-snug text-mute">
        {person.paymentMethod
          ? `${paidLabel}. Add more if they forgot something.`
          : personItems.length > 0
            ? `Finish ${firstName(person.name)}’s order, then take cash or QR. You can come back later.`
            : `What did ${firstName(person.name)} order? You can come back if you’re not done.`}
      </p>
      <button
        type="button"
        disabled={busy}
        className="mt-2 min-h-11 bg-transparent p-0 text-left font-sans text-[13px] text-mute underline"
        onClick={() => void removePerson()}
      >
        Wrong person
      </button>
      <p className="mt-1 text-xs text-mute">
        {person.paymentMethod
          ? "Removes them and puts their items back. Give the money back if you already took it."
          : "Removes them. Anything they claimed goes back on the table."}
      </p>

      <div className="mt-5 border-t border-dashed border-perf" />

      <p className="mt-4 font-mono text-[11px] text-mute">Still on the table</p>
      <ItemFind
        value={find}
        onChange={setFind}
        visibleCount={tableItems.length}
        totalCount={receipt.items.length}
        placeholder="Find what they ordered"
      />
      <div className="mt-2 flex flex-col gap-0.5">
        {find.trim() && tableItems.length === 0 ? (
          <p className="px-1.5 py-3 text-sm text-mute">Nothing matches that. Clear the find box to see the table.</p>
        ) : null}
        {tableItems.map((item) => {
          const claimed = item.remainingQuantity <= 0;
          const open = selectedId === item.id && !claimed;
          return (
            <div key={item.id}>
              <button
                type="button"
                disabled={claimed}
                onClick={() => {
                  setSelectedId(open ? null : item.id);
                  setQuantity(1);
                }}
                className={cn(
                  "flex min-h-[46px] w-full items-baseline gap-2 rounded-md bg-transparent px-1.5 py-[11px] text-left font-sans",
                  claimed ? "cursor-default opacity-45" : "hover:bg-inset",
                )}
              >
                <span className="text-base text-ink">{item.name}</span>
                <span className="font-mono text-[11px] text-mute">
                  {claimed ? "claimed" : `${item.remainingQuantity} left`}
                </span>
                <span className="leader" />
                <Money cents={item.unitPriceCents} currency={receipt.currency} className="text-[15px]" />
              </button>
              {open ? (
                <>
                  <div className="my-0.5 mb-2 flex items-center justify-between gap-3 rounded-[10px] bg-inset p-3.5">
                    <QuantityStepper value={quantity} max={item.remainingQuantity} onChange={setQuantity} />
                    <Button type="button" disabled={busy} className="h-[46px] w-auto px-[22px] text-[15px]" onClick={() => void addClaim()}>
                      Add
                    </Button>
                  </div>
                  {item.remainingQuantity === 1 ? (
                    <p className="-mt-1 mb-2 px-1.5 text-xs text-mute">That’s the last one, so the plus is locked.</p>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {personItems.length > 0 || (personSummary && personSummary.amountOwedCents > 0) ? (
        <div className="mt-3.5 rounded-[10px] bg-inset p-3.5">
          <p className="m-0 font-mono text-[11px] text-pandan">
            {person.name}’s share · {personItems.length === 1 ? "1 item" : `${personItems.length} items`}
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {personItems.map(({ assignment, item }) => (
              <div key={assignment.id} className="flex items-baseline gap-2">
                <span className="text-[15px]">
                  {item.name} ×{assignment.quantity}
                </span>
                <span className="leader" />
                <Money cents={item.unitPriceCents * assignment.quantity} currency={receipt.currency} className="text-sm" />
                <button
                  type="button"
                  disabled={busy}
                  className="bg-transparent p-0.5 font-sans text-xs text-mute underline"
                  onClick={() => void undoClaim(assignment.id)}
                >
                  undo
                </button>
              </div>
            ))}
            {personSummary ? <ChargeLines person={personSummary} currency={receipt.currency} /> : null}
          </div>
        </div>
      ) : (
        <p className="mt-3.5 text-sm text-mute">Nothing added yet — tap a line above, then take the money.</p>
      )}

      <EveryoneSoFar
        people={filteredPeople}
        summaries={summary?.people ?? []}
        currentId={person.id}
        label={filteredLabel}
        currency={receipt.currency}
        onOpen={openPerson}
      />
      <PocketLine cash={pocketCash} qr={pocketQr} currency={receipt.currency} />
      {error ? <p className="mt-4 text-sm text-alert">{error}</p> : null}
    </Docket>
  );
}

function ChargeLines({ person, currency }: { person: PersonSummaryDto; currency: string }) {
  const rows = [
    { label: "Service charge", cents: person.serviceChargeCents },
    { label: "Tax", cents: person.taxCents },
    { label: "Discount", cents: -person.discountCents },
    { label: "Rounding", cents: person.roundingCents },
  ].filter((row) => row.cents !== 0);

  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline gap-2">
          <span className="text-[15px] text-mute">{row.label}</span>
          <span className="leader" />
          <Money cents={row.cents} currency={currency} className="text-sm text-mute" />
        </div>
      ))}
    </>
  );
}

function seatVariant(seat: PersonDto, currentId: string | null, unsettled: boolean) {
  if (seat.id === currentId) return "live" as const;
  if (seat.paymentMethod && !unsettled) return "done" as const;
  return "waiting" as const;
}

function SeatChips({
  people,
  currentId,
  unsettledIds,
  onOpen,
}: {
  people: PersonDto[];
  currentId: string | null;
  unsettledIds: Set<string>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {people.map((seat) => (
        <button
          key={seat.id}
          type="button"
          className="bg-transparent p-0"
          aria-label={
            unsettledIds.has(seat.id)
              ? `${seat.name}, order changed after paying — tap to settle up`
              : seat.paymentMethod === "CASH"
              ? `${seat.name}, paid by cash`
              : seat.paymentMethod === "QR"
                ? `${seat.name}, paid by QR`
                : `${seat.name}, still collecting — tap to go back`
          }
          onClick={() => onOpen(seat.id)}
        >
          <PersonChip name={seat.name} size="md" variant={seatVariant(seat, currentId, unsettledIds.has(seat.id))} />
        </button>
      ))}
    </div>
  );
}

function EveryoneSoFar({
  people,
  summaries,
  currentId,
  label,
  currency,
  onOpen,
}: {
  people: PersonDto[];
  summaries: PersonSummaryDto[];
  currentId: string | null;
  label: string;
  currency: string;
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const others = people.filter((seat) => seat.id !== currentId);
  if (others.length === 0) return null;

  return (
    <div className="mt-5 border-t border-dashed border-perf pt-3">
      <button
        type="button"
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between bg-transparent p-0 text-left font-sans"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="font-mono text-[11px] text-mute">
          {label} · {others.length}
        </span>
        <span className="text-[13px] text-mute underline">{open ? "Hide" : "Check their orders"}</span>
      </button>
      {open ? (
        <div className="mt-1 flex flex-col gap-2">
          {others.map((seat) => {
            const row = summaries.find((summary) => summary.personId === seat.id);
            const items = row?.items ?? [];
            const balance = row?.balanceCents ?? 0;
            const paid =
              seat.paymentMethod === "CASH" ? "Paid by cash" : seat.paymentMethod === "QR" ? "Paid by QR" : "Not paid yet";
            const status =
              balance > 0
                ? `${paid} · collect ${formatMoney(balance, currency)} more`
                : balance < 0
                  ? `${paid} · give back ${formatMoney(-balance, currency)}`
                  : paid;
            return (
              <div key={seat.id} className="rounded-[10px] bg-inset p-3.5">
                <div className="flex items-center gap-2.5">
                  <PersonChip name={seat.name} size="sm" variant={seat.paymentMethod && balance === 0 ? "done" : "waiting"} />
                  <span className="text-[15px] font-medium">{seat.name}</span>
                  <span className="leader" />
                  <Money cents={row?.amountOwedCents ?? 0} currency={currency} className="text-[15px]" />
                </div>
                <p
                  className={cn(
                    "mt-1 font-mono text-[11px]",
                    balance !== 0 ? "text-alert" : seat.paymentMethod ? "text-pandan" : "text-amber",
                  )}
                >
                  {status}
                </p>
                {items.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-1">
                    {items.map((item) => (
                      <div key={item.itemId} className="flex items-baseline gap-2 text-sm">
                        <span>
                          {item.name} ×{item.quantity}
                        </span>
                        <span className="leader" />
                        <Money cents={item.lineTotalCents} currency={currency} className="text-sm text-mute" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-mute">Nothing added yet.</p>
                )}
                <button
                  type="button"
                  className="mt-2 min-h-11 bg-transparent p-0 font-sans text-[13px] text-mute underline"
                  onClick={() => onOpen(seat.id)}
                >
                  Go to {firstName(seat.name)}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function PocketLine({ cash, qr, currency }: { cash: number; qr: number; currency: string }) {
  if (cash === 0 && qr === 0) return null;
  return (
    <p className="mt-3.5 font-mono text-[11px] text-mute">
      In hand · cash {formatMoney(cash, currency)} · QR {formatMoney(qr, currency)}
    </p>
  );
}
