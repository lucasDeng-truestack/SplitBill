import type { ReceiptListItemDto } from "@splitbill/shared";
import { formatMoney, RECEIPT_RANGE_HEADINGS, RECEIPT_RANGE_LABELS, type ReceiptListRange } from "@splitbill/shared";
import { ClearTables } from "@/components/clear-tables";
import { PersonChip } from "@/components/person-chip";
import { cn } from "@/lib/utils";
import { joinNames, tableDate, tableTitle } from "@/lib/people";

const RANGES: ReceiptListRange[] = ["today", "7d", "all"];

function hrefFor(receipt: ReceiptListItemDto) {
  if (receipt.status === "COMPLETED") return `/bills/${receipt.id}/summary`;
  if (receipt.status === "COLLECTING") return `/bills/${receipt.id}/collect`;
  if (receipt.personCount > 0) return `/bills/${receipt.id}/collect`;
  return `/bills/${receipt.id}/review`;
}

function statusLine(receipt: ReceiptListItemDto) {
  if (receipt.status === "COMPLETED") {
    return <span className="ml-1 self-center font-mono text-[11px] text-pandan">all settled</span>;
  }
  if (receipt.unassignedItemCount > 0) {
    const label = receipt.unassignedItemCount === 1 ? "1 item unclaimed" : `${receipt.unassignedItemCount} items unclaimed`;
    return <span className="ml-1 self-center font-mono text-[11px] text-amber">{label}</span>;
  }
  if (receipt.itemCount > 0 && receipt.personCount > 0) {
    return <span className="ml-1 self-center font-mono text-[11px] text-pandan">all settled</span>;
  }
  return null;
}

export function ReceiptHistory({
  range,
  receipts,
}: {
  range: ReceiptListRange;
  receipts: ReceiptListItemDto[];
}) {
  return (
    <>
      <div className="mt-7 border-t border-dashed border-perf" />
      <div className="mt-5 flex items-center justify-between gap-3">
        <h2 className="font-mono text-[11px] font-normal text-mute">{RECEIPT_RANGE_HEADINGS[range]}</h2>
        <ClearTables range={range} count={receipts.length} />
      </div>
      <div className="mt-2.5 flex gap-1 rounded-full bg-inset p-1">
        {RANGES.map((value) => {
          const selected = value === range;
          return (
            <a
              key={value}
              href={`/?range=${value}`}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex-1 rounded-full py-2 text-center font-mono text-[11px] no-underline",
                selected ? "bg-ink text-docket" : "text-mute hover:text-ink",
              )}
            >
              {RECEIPT_RANGE_LABELS[value]}
            </a>
          );
        })}
      </div>
      {receipts.length === 0 ? (
        <p className="mt-6 max-w-[28ch] text-[15px] leading-snug text-mute">
          {range === "today"
            ? "No tables from today. Snap a new slip, or look at the last 7 days."
            : range === "7d"
              ? "Nothing in the last 7 days."
              : "No tables yet."}
        </p>
      ) : (
        <div className="mt-2.5 flex flex-col">
          {receipts.map((receipt, index) => (
            <a
              key={receipt.id}
              href={hrefFor(receipt)}
              className={cn(
                "block rounded-[10px] px-2 py-3.5 text-ink no-underline hover:bg-inset",
                index > 0 && "border-t border-dashed border-rule",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[17px] font-semibold tracking-[-0.01em]">{tableTitle(receipt.createdAt)}</p>
                  <p className="mt-0.5 text-[13px] text-mute">
                    {receipt.peopleNames.length > 0
                      ? `${joinNames(receipt.peopleNames)} · ${tableDate(receipt.createdAt)}`
                      : `${receipt.itemCount} items · ${tableDate(receipt.createdAt)}`}
                  </p>
                </div>
                <span className="font-mono text-[17px] font-medium tabular-nums">
                  {receipt.totalCents != null ? formatMoney(receipt.totalCents, receipt.currency) : "—"}
                </span>
              </div>
              {receipt.peopleNames.length > 0 ? (
                <div className="mt-2.5 flex items-center gap-[5px]">
                  {receipt.peopleNames.map((name) => (
                    <PersonChip key={name} name={name} size="sm" />
                  ))}
                  {statusLine(receipt)}
                </div>
              ) : null}
            </a>
          ))}
        </div>
      )}
    </>
  );
}
