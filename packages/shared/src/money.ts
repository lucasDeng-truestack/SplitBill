/**
 * Money is stored as integer minor units (sen for MYR).
 * RM 4.50 → 450
 *
 * Convert at API / parser boundaries only. Domain math uses integers.
 */

const CURRENCY_PREFIX: Record<string, string> = {
  MYR: "RM",
  SGD: "S$",
  USD: "$",
};

function splitMajorString(raw: string): { negative: boolean; whole: string; fraction: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Empty money value");
  }
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const match = unsigned.match(/^(\d+)(?:\.(\d{0,2}))?$/);
  if (!match) {
    throw new Error(`Invalid money value: ${raw}`);
  }
  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(2, "0").slice(0, 2);
  return { negative, whole, fraction };
}

export function majorToCents(value: number | string): number {
  const raw = typeof value === "number" ? value.toFixed(2) : value.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const { negative, whole, fraction } = splitMajorString(raw);
  const cents = Number(whole) * 100 + Number(fraction);
  return negative ? -cents : cents;
}

export function centsToMajor(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function formatMoney(cents: number, currency = "MYR"): string {
  const prefix = CURRENCY_PREFIX[currency] ?? `${currency} `;
  return `${prefix} ${centsToMajor(cents)}`.replace("  ", " ");
}

export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}
