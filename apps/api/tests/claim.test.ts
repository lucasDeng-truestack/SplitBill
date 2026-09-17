import { describe, expect, it } from "vitest";
import { claimItem, remainingQuantity } from "../src/domain/claim.js";

const rotiTelur = {
  id: "item-1",
  name: "Roti telur",
  quantity: 2,
  unitPriceCents: 400,
  totalPriceCents: 800,
  assignedQuantity: 0,
};

describe("claimItem", () => {
  it("claims 1 of 2 then the remaining 1", () => {
    const first = claimItem({ item: rotiTelur, quantity: 1 });
    expect(first.assignedQuantity).toBe(1);
    expect(first.remainingQuantity).toBe(1);

    const second = claimItem({
      item: { ...rotiTelur, assignedQuantity: first.assignedQuantity },
      quantity: 1,
    });
    expect(second.assignedQuantity).toBe(2);
    expect(second.remainingQuantity).toBe(0);
  });

  it("rejects claiming beyond remaining quantity", () => {
    expect(() => claimItem({ item: rotiTelur, quantity: 3 })).toThrow("OVER_ALLOCATION");
    expect(() =>
      claimItem({ item: { ...rotiTelur, assignedQuantity: 1 }, quantity: 2 }),
    ).toThrow("OVER_ALLOCATION");
  });

  it("allows claiming multiple quantity when available", () => {
    const result = claimItem({ item: rotiTelur, quantity: 2 });
    expect(result.assignedQuantity).toBe(2);
    expect(result.remainingQuantity).toBe(0);
  });

  it("rejects non-positive quantity", () => {
    expect(() => claimItem({ item: rotiTelur, quantity: 0 })).toThrow("INVALID_QUANTITY");
    expect(() => claimItem({ item: rotiTelur, quantity: -1 })).toThrow("INVALID_QUANTITY");
  });

  it("computes remaining quantity", () => {
    expect(remainingQuantity(rotiTelur)).toBe(2);
    expect(remainingQuantity({ ...rotiTelur, assignedQuantity: 2 })).toBe(0);
  });
});
