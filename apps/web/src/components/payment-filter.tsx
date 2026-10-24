"use client";

import { PAYMENT_FILTERS, paymentFilterLabel, type PaymentFilter } from "@/lib/payment-filter";
import { cn } from "@/lib/utils";

export function PaymentFilterControl({
  value,
  counts,
  onChange,
  className,
}: {
  value: PaymentFilter;
  counts: Record<PaymentFilter, number>;
  onChange: (value: PaymentFilter) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Show people who" className={cn("flex flex-wrap gap-1.5", className)}>
      {PAYMENT_FILTERS.map((filter) => {
        const active = filter === value;
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(filter)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 font-sans text-[13px] transition-colors",
              active
                ? "border-ink bg-ink text-docket"
                : "border-perf bg-transparent text-mute hover:border-ink hover:text-ink",
            )}
          >
            {paymentFilterLabel(filter)}
            <span className={cn("font-mono text-[11px]", active ? "text-docket/80" : "text-faint")}>{counts[filter]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PaymentFilterEmpty({
  filter,
  onShowAll,
}: {
  filter: PaymentFilter;
  onShowAll: () => void;
}) {
  return (
    <p className="mt-3 text-sm text-mute">
      {filter === "unpaid" ? "Everyone has paid." : "Nobody has paid yet."}{" "}
      <button
        type="button"
        className="bg-transparent p-0 font-sans text-sm text-mute underline"
        onClick={onShowAll}
      >
        Show everyone
      </button>
    </p>
  );
}
