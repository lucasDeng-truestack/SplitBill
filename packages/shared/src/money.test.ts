import { describe, expect, it } from "vitest";
import { centsToMajor, formatMoney, majorToCents } from "./money.js";

describe("money", () => {
  it("converts major units to sen without float drift", () => {
    expect(majorToCents(4.5)).toBe(450);
    expect(majorToCents("4.50")).toBe(450);
    expect(majorToCents("1.70")).toBe(170);
    expect(majorToCents(0.1)).toBe(10);
    expect(majorToCents(-0.05)).toBe(-5);
  });

  it("formats sen as two-decimal major units", () => {
    expect(centsToMajor(450)).toBe("4.50");
    expect(centsToMajor(170)).toBe("1.70");
    expect(formatMoney(400, "MYR")).toBe("RM 4.00");
    expect(formatMoney(170, "MYR")).toBe("RM 1.70");
  });
});
