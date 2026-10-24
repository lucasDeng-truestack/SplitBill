import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYMENT_FILTER,
  filterByPayment,
  isPaidUp,
  matchesPaymentFilter,
  paymentFilterCounts,
  type PaymentStanding,
} from "./payment-filter";

const people: Array<{ name: string } & PaymentStanding> = [
  { name: "Alice", paymentMethod: "CASH", balanceCents: 0 },
  { name: "Bob", paymentMethod: null, balanceCents: 0 },
  { name: "Carol", paymentMethod: "QR", balanceCents: 300 },
  { name: "Dan", paymentMethod: "QR", balanceCents: -170 },
  { name: "Eve", paymentMethod: "QR", balanceCents: 0 },
];
const standing = (row: PaymentStanding) => row;

describe("payment filter", () => {
  it("defaults to the people you still need to collect from", () => {
    expect(DEFAULT_PAYMENT_FILTER).toBe("unpaid");
  });

  it("only counts a settled payment as paid up", () => {
    expect(isPaidUp({ paymentMethod: "CASH", balanceCents: 0 })).toBe(true);
    expect(isPaidUp({ paymentMethod: null, balanceCents: 0 })).toBe(false);
    expect(isPaidUp({ paymentMethod: "QR", balanceCents: 50 })).toBe(false);
    expect(isPaidUp({ paymentMethod: "QR", balanceCents: -50 })).toBe(false);
  });

  it("puts unpaid people and changed orders under Haven’t paid", () => {
    expect(filterByPayment(people, standing, "unpaid").map((row) => row.name)).toEqual(["Bob", "Carol", "Dan"]);
    expect(filterByPayment(people, standing, "paid").map((row) => row.name)).toEqual(["Alice", "Eve"]);
    expect(filterByPayment(people, standing, "all").map((row) => row.name)).toEqual([
      "Alice",
      "Bob",
      "Carol",
      "Dan",
      "Eve",
    ]);
  });

  it("keeps the original order", () => {
    expect(filterByPayment(people, standing, "unpaid").map((row) => row.name)).toEqual(["Bob", "Carol", "Dan"]);
  });

  it("counts every bucket so the pills can show them", () => {
    expect(paymentFilterCounts(people, standing)).toEqual({ unpaid: 3, paid: 2, all: 5 });
    expect(paymentFilterCounts([], standing)).toEqual({ unpaid: 0, paid: 0, all: 0 });
  });

  it("matches one person against a filter", () => {
    expect(matchesPaymentFilter({ paymentMethod: null, balanceCents: 0 }, "unpaid")).toBe(true);
    expect(matchesPaymentFilter({ paymentMethod: null, balanceCents: 0 }, "paid")).toBe(false);
    expect(matchesPaymentFilter({ paymentMethod: null, balanceCents: 0 }, "all")).toBe(true);
  });
});
