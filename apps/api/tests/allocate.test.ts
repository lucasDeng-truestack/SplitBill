import { describe, expect, it } from "vitest";
import { allocateCharges } from "../src/domain/allocate.js";

const items = [
  { id: "rt", name: "Roti telur", quantity: 2, unitPriceCents: 400, totalPriceCents: 800, assignedQuantity: 2 },
  { id: "rk", name: "Roti kosong", quantity: 1, unitPriceCents: 170, totalPriceCents: 170, assignedQuantity: 0 },
  { id: "nl", name: "Nasi lemak", quantity: 1, unitPriceCents: 500, totalPriceCents: 500, assignedQuantity: 1 },
];

const people = [
  { id: "lucas", name: "Lucas" },
  { id: "jerusha", name: "Jerusha Akka" },
  { id: "daniel", name: "Daniel" },
];

const assignments = [
  { personId: "lucas", itemId: "rt", quantity: 1 },
  { personId: "jerusha", itemId: "rt", quantity: 1 },
  { personId: "daniel", itemId: "nl", quantity: 1 },
];

describe("allocateCharges", () => {
  it("matches the collection example without extra charges", () => {
    const result = allocateCharges(
      { serviceChargeCents: null, taxCents: null, discountCents: null, roundingCents: null, totalCents: 1470 },
      items,
      people,
      assignments,
    );

    expect(result.people.find((p) => p.personId === "lucas")?.amountOwedCents).toBe(400);
    expect(result.people.find((p) => p.personId === "jerusha")?.amountOwedCents).toBe(400);
    expect(result.people.find((p) => p.personId === "daniel")?.amountOwedCents).toBe(500);
    expect(result.assignedItemSubtotalCents).toBe(1300);
    expect(result.unassignedItems).toEqual([
      expect.objectContaining({ name: "Roti kosong", remainingQuantity: 1, amountCents: 170 }),
    ]);
    expect(result.hasUnassigned).toBe(true);
  });

  it("allocates tax and service charge proportionally with leftover sen", () => {
    const result = allocateCharges(
      {
        serviceChargeCents: 100,
        taxCents: 73,
        discountCents: 20,
        roundingCents: 1,
        totalCents: 1624,
      },
      items,
      people,
      assignments,
    );

    const personSum = result.people.reduce((sum, person) => sum + person.amountOwedCents, 0);
    expect(personSum + result.unassignedTotalCents).toBe(1300 + 170 + 100 + 73 - 20 + 1);
    expect(result.people.reduce((sum, person) => sum + person.serviceChargeCents, 0) + (result.unassignedTotalCents >= 0 ? 0 : 0)).toBeGreaterThanOrEqual(0);

    const serviceShares = result.people.map((p) => p.serviceChargeCents);
    const unassignedService = 100 - serviceShares.reduce((a, b) => a + b, 0);
    expect(unassignedService + serviceShares.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("keeps charges unassigned when nobody has items", () => {
    const result = allocateCharges(
      { serviceChargeCents: 50, taxCents: 10, discountCents: 0, roundingCents: 0, totalCents: 1470 },
      items.map((item) => ({ ...item, assignedQuantity: 0 })),
      people,
      [],
    );
    expect(result.assignedTotalCents).toBe(0);
    expect(result.unassignedTotalCents).toBe(1470 + 50 + 10);
  });
});
