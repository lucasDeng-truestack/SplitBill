import { sumCents } from "@splitbill/shared";
import { lineTotalCents, remainingQuantity, type AssignmentState, type InventoryItem } from "./claim.js";

export type ChargeReceipt = {
  serviceChargeCents: number | null;
  taxCents: number | null;
  discountCents: number | null;
  roundingCents: number | null;
  totalCents: number | null;
};

export type PersonRef = {
  id: string;
  name: string;
};

export type PersonLine = {
  itemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type PersonAllocation = {
  personId: string;
  name: string;
  items: PersonLine[];
  itemSubtotalCents: number;
  serviceChargeCents: number;
  taxCents: number;
  discountCents: number;
  roundingCents: number;
  amountOwedCents: number;
};

export type UnassignedLine = {
  itemId: string;
  name: string;
  remainingQuantity: number;
  unitPriceCents: number;
  amountCents: number;
};

export type BillAllocation = {
  people: PersonAllocation[];
  unassignedItems: UnassignedLine[];
  assignedItemSubtotalCents: number;
  unassignedItemSubtotalCents: number;
  assignedTotalCents: number;
  unassignedTotalCents: number;
  receiptTotalCents: number | null;
  hasUnassigned: boolean;
};

const UNASSIGNED_ID = "__unassigned__";

function allocateByLargestRemainder(
  amount: number,
  weights: Array<{ id: string; weight: number }>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of weights) {
    result[row.id] = 0;
  }
  if (amount === 0) return result;

  const totalWeight = sumCents(weights.map((row) => row.weight));
  if (totalWeight === 0) {
    result[UNASSIGNED_ID] = (result[UNASSIGNED_ID] ?? 0) + amount;
    return result;
  }

  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);
  const remainders: Array<{ id: string; remainder: number }> = [];
  let distributed = 0;

  for (const row of weights) {
    const exact = (abs * row.weight) / totalWeight;
    const floored = Math.floor(exact);
    result[row.id] = floored * sign;
    distributed += floored;
    remainders.push({ id: row.id, remainder: exact - floored });
  }

  let leftover = abs - distributed;
  remainders.sort((a, b) => b.remainder - a.remainder);
  let index = 0;
  while (leftover > 0 && remainders.length > 0) {
    const target = remainders[index % remainders.length];
    if (target) {
      result[target.id] = (result[target.id] ?? 0) + sign;
    }
    leftover -= 1;
    index += 1;
  }
  return result;
}

export function allocateCharges(
  receipt: ChargeReceipt,
  items: InventoryItem[],
  people: PersonRef[],
  assignments: AssignmentState[],
): BillAllocation {
  const itemsById = new Map(items.map((item) => [item.id, item]));

  const personLines = new Map<string, PersonLine[]>();
  for (const person of people) {
    personLines.set(person.id, []);
  }

  for (const assignment of assignments) {
    const item = itemsById.get(assignment.itemId);
    if (!item) continue;
    const lines = personLines.get(assignment.personId);
    if (!lines) continue;
    lines.push({
      itemId: item.id,
      name: item.name,
      quantity: assignment.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: lineTotalCents(assignment.quantity, item.unitPriceCents),
    });
  }

  const unassignedItems: UnassignedLine[] = items
    .map((item) => {
      const remaining = remainingQuantity(item);
      return {
        itemId: item.id,
        name: item.name,
        remainingQuantity: remaining,
        unitPriceCents: item.unitPriceCents,
        amountCents: lineTotalCents(remaining, item.unitPriceCents),
      };
    })
    .filter((row) => row.remainingQuantity > 0);

  const personSubtotals = people.map((person) => ({
    id: person.id,
    weight: sumCents((personLines.get(person.id) ?? []).map((line) => line.lineTotalCents)),
  }));
  const unassignedItemSubtotalCents = sumCents(unassignedItems.map((row) => row.amountCents));
  const weights = [...personSubtotals, { id: UNASSIGNED_ID, weight: unassignedItemSubtotalCents }];

  const service = allocateByLargestRemainder(receipt.serviceChargeCents ?? 0, weights);
  const tax = allocateByLargestRemainder(receipt.taxCents ?? 0, weights);
  const discount = allocateByLargestRemainder(receipt.discountCents ?? 0, weights);
  const rounding = allocateByLargestRemainder(receipt.roundingCents ?? 0, weights);

  const peopleAllocations: PersonAllocation[] = people.map((person) => {
    const itemsForPerson = personLines.get(person.id) ?? [];
    const itemSubtotalCents = sumCents(itemsForPerson.map((line) => line.lineTotalCents));
    const serviceChargeCents = service[person.id] ?? 0;
    const taxCents = tax[person.id] ?? 0;
    const discountCents = discount[person.id] ?? 0;
    const roundingCents = rounding[person.id] ?? 0;
    return {
      personId: person.id,
      name: person.name,
      items: itemsForPerson,
      itemSubtotalCents,
      serviceChargeCents,
      taxCents,
      discountCents,
      roundingCents,
      amountOwedCents: itemSubtotalCents + serviceChargeCents + taxCents - discountCents + roundingCents,
    };
  });

  const assignedItemSubtotalCents = sumCents(peopleAllocations.map((row) => row.itemSubtotalCents));
  const assignedTotalCents = sumCents(peopleAllocations.map((row) => row.amountOwedCents));
  const unassignedTotalCents =
    unassignedItemSubtotalCents +
    (service[UNASSIGNED_ID] ?? 0) +
    (tax[UNASSIGNED_ID] ?? 0) -
    (discount[UNASSIGNED_ID] ?? 0) +
    (rounding[UNASSIGNED_ID] ?? 0);

  return {
    people: peopleAllocations,
    unassignedItems,
    assignedItemSubtotalCents,
    unassignedItemSubtotalCents,
    assignedTotalCents,
    unassignedTotalCents,
    receiptTotalCents: receipt.totalCents,
    hasUnassigned: unassignedItems.length > 0,
  };
}
