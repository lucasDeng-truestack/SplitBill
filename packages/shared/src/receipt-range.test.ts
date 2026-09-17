import { describe, expect, it } from "vitest";
import { parseReceiptListRange, receiptRangeStart } from "./receipt-range.js";

describe("receipt range", () => {
  const noon = new Date("2026-09-18T12:00:00+08:00");

  it("parses known ranges and falls back", () => {
    expect(parseReceiptListRange("today")).toBe("today");
    expect(parseReceiptListRange("7d")).toBe("7d");
    expect(parseReceiptListRange("all")).toBe("all");
    expect(parseReceiptListRange("nope", "today")).toBe("today");
  });

  it("starts today at KL midnight", () => {
    expect(receiptRangeStart("today", noon)).toEqual(new Date("2026-09-18T00:00:00+08:00"));
  });

  it("includes the past 7 calendar days", () => {
    expect(receiptRangeStart("7d", noon)).toEqual(new Date("2026-09-12T00:00:00+08:00"));
  });

  it("has no start for all", () => {
    expect(receiptRangeStart("all", noon)).toBeNull();
  });
});
