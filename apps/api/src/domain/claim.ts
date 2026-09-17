export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  assignedQuantity: number;
};

export type AssignmentState = {
  personId: string;
  itemId: string;
  quantity: number;
};

export function remainingQuantity(item: InventoryItem): number {
  return item.quantity - item.assignedQuantity;
}

export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  return quantity * unitPriceCents;
}

export function claimItem(input: {
  item: InventoryItem;
  quantity: number;
}): { remainingQuantity: number; assignedQuantity: number } {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("INVALID_QUANTITY");
  }
  const remaining = remainingQuantity(input.item);
  if (input.quantity > remaining) {
    throw new Error("OVER_ALLOCATION");
  }
  const assignedQuantity = input.item.assignedQuantity + input.quantity;
  return {
    assignedQuantity,
    remainingQuantity: input.item.quantity - assignedQuantity,
  };
}
