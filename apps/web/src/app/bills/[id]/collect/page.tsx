"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney } from "@splitbill/shared";
import type { PaymentMethod, PersonDto, ReceiptDto, ReceiptItemDto } from "@splitbill/shared";
import { Docket } from "@/components/docket";
import { Money } from "@/components/money";
import { PersonChip } from "@/components/person-chip";
import { QuantityStepper } from "@/components/quantity-stepper";
import { StepPath } from "@/components/step-path";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { firstName } from "@/lib/people";
import { cn } from "@/lib/utils";

export default function CollectPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<ReceiptDto | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { receipt: data } = await api.getReceipt(id);
    setReceipt(data);
    return data;
  }, [id]);

  useEffect(() => {
    refresh()
      .then((data) => {
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

  const owedCents = personItems.reduce((sum, row) => sum + row.item.unitPriceCents * row.assignment.quantity, 0);

  async function addClaim() {
    if (!person || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.claim(id, { personId: person.id, itemId: selected.id, quantity });
      const updated = await refresh();
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

  async function addPerson() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addPerson(id, { name: name.trim() });
      const updated = await refresh();
      const next = updated.people[updated.people.length - 1];
      setName("");
      setAdding(false);
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
    setSelectedId(null);
    setQuantity(1);
    setError(null);
  }

  function comeBackLater() {
    setAdding(true);
    setName("");
    setSelectedId(null);
    setQuantity(1);
    setError(null);
  }

  async function removePerson() {
    if (!person) return;
    setBusy(true);
    setError(null);
    try {
      await api.deletePerson(id, person.id);
      const updated = await refresh();
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
    if (!person || owedCents <= 0) return;
    const firstPayment = person.paymentMethod == null;
    setBusy(true);
    setError(null);
    try {
      await api.updatePerson(id, person.id, { paymentMethod: method });
      await refresh();
      if (firstPayment) comeBackLater();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record how they paid.");
    } finally {
      setBusy(false);
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
  const pocket = pocketTotals(receipt);

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
          <div className="flex items-center justify-between gap-3">
            <p className="m-0 font-mono text-xs text-amber">
              {collectedCount === 1 ? "1 person so far" : `${collectedCount} people so far`}
            </p>
            <SeatChips people={receipt.people} currentId={null} onOpen={openPerson} />
          </div>
        ) : null}
        <h1 className="mt-2.5 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em]">
          {collectedCount === 0 ? "Walk up to someone" : "Who’s next?"}
        </h1>
        <p className="mt-2 text-[15px] leading-snug text-mute">
          {collectedCount === 0
            ? "Add their name, tap what they ordered, and take the money before you walk on."
            : "Add the next person, or tap a face to go back to someone you already started with."}
        </p>
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
        <PocketLine cash={pocket.cash} qr={pocket.qr} currency={receipt.currency} />
        {error ? <p className="mt-4 text-sm text-alert">{error}</p> : null}
      </Docket>
    );
  }

  const paidLabel =
    person.paymentMethod === "CASH" ? "Paid by cash" : person.paymentMethod === "QR" ? "Paid by QR" : null;

  return (
    <Docket
      footer={
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-mute">{paidLabel ?? `Collect from ${firstName(person.name)}`}</span>
            <Money cents={owedCents} currency={receipt.currency} className="text-[22px] text-amber" />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={person.paymentMethod === "CASH" ? "primary" : "secondary"}
              className="flex-1"
              disabled={busy || owedCents <= 0}
              onClick={() => void collectWith("CASH")}
            >
              Cash
            </Button>
            <Button
              type="button"
              variant={person.paymentMethod === "QR" ? "primary" : "secondary"}
              className="flex-1"
              disabled={busy || owedCents <= 0}
              onClick={() => void collectWith("QR")}
            >
              QR
            </Button>
          </div>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost" }), "mt-1 w-full justify-center")}
            onClick={comeBackLater}
          >
            I’ll come back
          </button>
          <p className="mt-2 text-center text-[13px] text-mute">
            {owedCents <= 0
              ? "Tap what they ordered. You can leave and come back."
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

      <div className="flex items-center justify-between gap-3">
        <p className="m-0 font-mono text-xs text-amber">
          {collectedCount === 1 ? "1st person" : `Person ${receipt.people.findIndex((seat) => seat.id === person.id) + 1}`}
        </p>
        <SeatChips people={receipt.people} currentId={person.id} onOpen={openPerson} />
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
      <div className="mt-2 flex flex-col gap-0.5">
        {receipt.items.map((item) => {
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

      {personItems.length > 0 ? (
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
                  className="bg-transparent p-0.5 font-sans text-xs text-mute underline"
                  onClick={async () => {
                    await api.deleteAssignment(id, assignment.id);
                    await refresh();
                  }}
                >
                  undo
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3.5 text-sm text-mute">Nothing added yet — tap a line above, then take the money.</p>
      )}

      <PocketLine cash={pocket.cash} qr={pocket.qr} currency={receipt.currency} />
      {error ? <p className="mt-4 text-sm text-alert">{error}</p> : null}
    </Docket>
  );
}

function shareCents(receipt: ReceiptDto, personId: string) {
  return receipt.assignments
    .filter((assignment) => assignment.personId === personId)
    .reduce((sum, assignment) => {
      const item = receipt.items.find((row) => row.id === assignment.itemId);
      return item ? sum + item.unitPriceCents * assignment.quantity : sum;
    }, 0);
}

function pocketTotals(receipt: ReceiptDto) {
  let cash = 0;
  let qr = 0;
  for (const seat of receipt.people) {
    const amount = shareCents(receipt, seat.id);
    if (seat.paymentMethod === "CASH") cash += amount;
    if (seat.paymentMethod === "QR") qr += amount;
  }
  return { cash, qr };
}

function seatVariant(seat: PersonDto, currentId: string | null) {
  if (seat.id === currentId) return "live" as const;
  if (seat.paymentMethod) return "done" as const;
  return "waiting" as const;
}

function SeatChips({
  people,
  currentId,
  onOpen,
}: {
  people: PersonDto[];
  currentId: string | null;
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
            seat.paymentMethod === "CASH"
              ? `${seat.name}, paid by cash`
              : seat.paymentMethod === "QR"
                ? `${seat.name}, paid by QR`
                : `${seat.name}, still collecting — tap to go back`
          }
          onClick={() => onOpen(seat.id)}
        >
          <PersonChip name={seat.name} size="md" variant={seatVariant(seat, currentId)} />
        </button>
      ))}
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
