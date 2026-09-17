import { describe, expect, it } from "vitest";
import {
  completeReceiptBodySchema,
  createAssignmentBodySchema,
  createPersonBodySchema,
} from "@splitbill/shared";

describe("API request validation", () => {
  it("rejects empty person names", () => {
    const result = createPersonBodySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive assignment quantity", () => {
    const result = createAssignmentBodySchema.safeParse({
      personId: "not-a-uuid",
      itemId: "also-bad",
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid claim payload", () => {
    const result = createAssignmentBodySchema.safeParse({
      personId: "11111111-1111-4111-8111-111111111111",
      itemId: "22222222-2222-4222-8222-222222222222",
      quantity: 2,
    });
    expect(result.success).toBe(true);
  });

  it("defaults allowUnassigned to false", () => {
    const result = completeReceiptBodySchema.parse({});
    expect(result.allowUnassigned).toBe(false);
  });
});
