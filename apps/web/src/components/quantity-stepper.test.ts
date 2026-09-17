import { describe, expect, it } from "vitest";
import { clampQuantity } from "./quantity-stepper";

describe("clampQuantity", () => {
  it("does not exceed remaining quantity", () => {
    expect(clampQuantity(3, 1, 1)).toBe(1);
    expect(clampQuantity(0, 1, 2)).toBe(1);
    expect(clampQuantity(2, 1, 2)).toBe(2);
  });
});
