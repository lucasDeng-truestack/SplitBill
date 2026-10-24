import type { PaymentMethod } from "@splitbill/shared";

export type PaymentFilter = "unpaid" | "paid" | "all";

export const PAYMENT_FILTERS: readonly PaymentFilter[] = ["unpaid", "paid", "all"];
export const DEFAULT_PAYMENT_FILTER: PaymentFilter = "unpaid";

/** What the filter needs to know about one person. */
export type PaymentStanding = {
  paymentMethod: PaymentMethod | null;
  /** amountOwed − paid; non-zero means their order changed after they paid. */
  balanceCents: number;
};

/** Paid and nothing left to collect or give back. */
export function isPaidUp(standing: PaymentStanding): boolean {
  return standing.paymentMethod != null && standing.balanceCents === 0;
}

export function matchesPaymentFilter(standing: PaymentStanding, filter: PaymentFilter): boolean {
  if (filter === "all") return true;
  return filter === "paid" ? isPaidUp(standing) : !isPaidUp(standing);
}

export function filterByPayment<T>(
  rows: readonly T[],
  standingOf: (row: T) => PaymentStanding,
  filter: PaymentFilter,
): T[] {
  if (filter === "all") return [...rows];
  return rows.filter((row) => matchesPaymentFilter(standingOf(row), filter));
}

export function paymentFilterCounts<T>(
  rows: readonly T[],
  standingOf: (row: T) => PaymentStanding,
): Record<PaymentFilter, number> {
  const paid = rows.filter((row) => isPaidUp(standingOf(row))).length;
  return { unpaid: rows.length - paid, paid, all: rows.length };
}

export function paymentFilterLabel(filter: PaymentFilter): string {
  if (filter === "unpaid") return "Haven’t paid";
  if (filter === "paid") return "Paid";
  return "All";
}
