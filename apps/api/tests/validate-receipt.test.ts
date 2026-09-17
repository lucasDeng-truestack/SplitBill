import { describe, expect, it } from "vitest";
import { validateParsedReceipt } from "../src/domain/validate-receipt.js";
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
