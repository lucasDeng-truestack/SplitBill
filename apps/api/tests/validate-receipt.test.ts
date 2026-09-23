import { describe, expect, it } from "vitest";
import { reconcileParsedReceipt, validateParsedReceipt } from "../src/domain/validate-receipt.js";
import { MOCK_RECEIPT } from "../src/parsers/mock-parser.js";

describe("validateParsedReceipt", () => {
  it("accepts the mock kopitiam receipt", () => {
    const { issues } = validateParsedReceipt(MOCK_RECEIPT);
    expect(issues).toEqual([]);
  });

  it("flags quantity × unit price mismatches", () => {
    const { issues } = validateParsedReceipt({
      items: [{ name: "Roti telur", quantity: 2, unitPrice: 4, totalPrice: 9 }],
      total: 9,
    });
    expect(issues.some((issue) => issue.code === "LINE_TOTAL_MISMATCH")).toBe(true);
  });

  it("flags receipt total mismatches including charges", () => {
    const { issues } = validateParsedReceipt({
      items: [{ name: "Nasi lemak", quantity: 1, unitPrice: 5, totalPrice: 5 }],
      serviceCharge: 0.5,
      tax: 0.3,
      total: 99,
    });
    expect(issues.some((issue) => issue.code === "RECEIPT_TOTAL_MISMATCH")).toBe(true);
  });
});

describe("reconcileParsedReceipt", () => {
  it("restores quantity when the line total is a clean multiple of unit price", () => {
    const receipt = reconcileParsedReceipt({
      items: [{ name: "Capati Biasa", quantity: 1, unitPrice: 2.8, totalPrice: 5.6 }],
      total: 5.6,
    });
    expect(receipt.items[0]?.quantity).toBe(2);
    expect(receipt.items[0]?.unitPrice).toBe(2.8);
  });

  it("restores unit price when quantity and line total were printed", () => {
    const receipt = reconcileParsedReceipt({
      items: [{ name: "Roti Telur Bawang", quantity: 2, unitPrice: 7.2, totalPrice: 7.2 }],
      total: 7.2,
    });
    expect(receipt.items[0]?.quantity).toBe(2);
    expect(receipt.items[0]?.unitPrice).toBe(3.6);
    expect(receipt.items[0]?.totalPrice).toBe(7.2);
  });

  it("leaves consistent lines alone", () => {
    const receipt = reconcileParsedReceipt({
      items: [{ name: "Watermelon Juice", quantity: 1, unitPrice: 7.5, totalPrice: 7.5 }],
      total: 7.5,
    });
    expect(receipt.items[0]).toEqual({ name: "Watermelon Juice", quantity: 1, unitPrice: 7.5, totalPrice: 7.5 });
  });
});
