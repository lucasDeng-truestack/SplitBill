import { z } from "zod";

export const RECEIPT_TIME_ZONE = "Asia/Kuala_Lumpur";

export const receiptListRangeSchema = z.enum(["today", "7d", "all"]);
export type ReceiptListRange = z.infer<typeof receiptListRangeSchema>;

export function parseReceiptListRange(value: unknown, fallback: ReceiptListRange = "all"): ReceiptListRange {
  const parsed = receiptListRangeSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export function zonedDayKey(date: Date, timeZone = RECEIPT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function startOfZonedDay(date: Date, timeZone = RECEIPT_TIME_ZONE): Date {
  const key = zonedDayKey(date, timeZone);
  return new Date(`${key}T00:00:00+08:00`);
}

export function receiptRangeStart(range: ReceiptListRange, now = new Date()): Date | null {
  if (range === "all") return null;
  const todayStart = startOfZonedDay(now);
  if (range === "today") return todayStart;
  return new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
}

export const RECEIPT_RANGE_LABELS: Record<ReceiptListRange, string> = {
  today: "Today",
  "7d": "7 days",
  all: "All",
};

export const RECEIPT_RANGE_HEADINGS: Record<ReceiptListRange, string> = {
  today: "Today’s tables",
  "7d": "Last 7 days",
  all: "All tables",
};

export const RECEIPT_RANGE_CLEAR_LABELS: Record<ReceiptListRange, string> = {
  today: "Clear today",
  "7d": "Clear last 7 days",
  all: "Clear all tables",
};
