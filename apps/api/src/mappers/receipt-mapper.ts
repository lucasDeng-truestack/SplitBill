import type {
  AssignmentDto,
  BillSummaryDto,
  PersonDto,
  ReceiptDto,
  ReceiptItemDto,
  ReceiptListItemDto,
  ValidationIssue,
} from "@splitbill/shared";
import type { ItemAssignment, Person, Receipt, ReceiptItem } from "@prisma/client";
import { remainingQuantity } from "../domain/claim.js";
import type { BillAllocation } from "../domain/allocate.js";

type ReceiptWithRelations = Receipt & {
  items: ReceiptItem[];
  people: Person[];
  assignments: ItemAssignment[];
};

function asIssues(value: unknown): ValidationIssue[] {
  if (!Array.isArray(value)) return [];
  return value as ValidationIssue[];
}

export function toItemDto(item: ReceiptItem): ReceiptItemDto {
  return {
    id: item.id,
    receiptId: item.receiptId,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    totalPriceCents: item.totalPriceCents,
    assignedQuantity: item.assignedQuantity,
    remainingQuantity: remainingQuantity(item),
    sortOrder: item.sortOrder,
  };
}

export function toPersonDto(person: Person): PersonDto {
  return {
    id: person.id,
    receiptId: person.receiptId,
    name: person.name,
    sortOrder: person.sortOrder,
    paymentMethod: person.paymentMethod,
  };
}

export function toAssignmentDto(assignment: ItemAssignment): AssignmentDto {
  return {
    id: assignment.id,
    receiptId: assignment.receiptId,
    personId: assignment.personId,
    itemId: assignment.itemId,
    quantity: assignment.quantity,
  };
}

export function toReceiptDto(receipt: ReceiptWithRelations): ReceiptDto {
  return {
    id: receipt.id,
    currency: receipt.currency,
    status: receipt.status,
    subtotalCents: receipt.subtotalCents,
    discountCents: receipt.discountCents,
    serviceChargeCents: receipt.serviceChargeCents,
    taxCents: receipt.taxCents,
    roundingCents: receipt.roundingCents,
    totalCents: receipt.totalCents,
    imagePath: null,
    parserProvider: receipt.parserProvider,
    validationIssues: asIssues(receipt.validationIssues),
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString(),
    items: [...receipt.items].sort((a, b) => a.sortOrder - b.sortOrder).map(toItemDto),
    people: [...receipt.people].sort((a, b) => a.sortOrder - b.sortOrder).map(toPersonDto),
    assignments: receipt.assignments.map(toAssignmentDto),
  };
}

export function toReceiptListItemDto(
  receipt: Receipt & {
    people: Array<{ name: string }>;
    items: Array<{ quantity: number; assignedQuantity: number }>;
  },
): ReceiptListItemDto {
  return {
    id: receipt.id,
    currency: receipt.currency,
    status: receipt.status,
    totalCents: receipt.totalCents,
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString(),
    itemCount: receipt.items.length,
    personCount: receipt.people.length,
    peopleNames: receipt.people.map((person) => person.name),
    unassignedItemCount: receipt.items.filter((item) => item.quantity - item.assignedQuantity > 0).length,
  };
}

export function toSummaryDto(
  receiptId: string,
  currency: string,
  status: ReceiptDto["status"],
  allocation: BillAllocation,
  people: Array<{ id: string; paymentMethod: PersonDto["paymentMethod"] }>,
): BillSummaryDto {
  const methodById = new Map(people.map((person) => [person.id, person.paymentMethod]));
  const summaryPeople = allocation.people.map((person) => ({
    ...person,
    paymentMethod: methodById.get(person.personId) ?? null,
  }));

  return {
    receiptId,
    currency,
    status,
    people: summaryPeople,
    unassignedItems: allocation.unassignedItems,
    assignedItemSubtotalCents: allocation.assignedItemSubtotalCents,
    unassignedItemSubtotalCents: allocation.unassignedItemSubtotalCents,
    assignedTotalCents: allocation.assignedTotalCents,
    unassignedTotalCents: allocation.unassignedTotalCents,
    cashTotalCents: sumByMethod(summaryPeople, "CASH"),
    qrTotalCents: sumByMethod(summaryPeople, "QR"),
    unpaidTotalCents: summaryPeople
      .filter((person) => person.paymentMethod == null)
      .reduce((sum, person) => sum + person.amountOwedCents, 0),
    receiptTotalCents: allocation.receiptTotalCents,
    hasUnassigned: allocation.hasUnassigned,
  };
}

function sumByMethod(
  people: Array<{ paymentMethod: PersonDto["paymentMethod"]; amountOwedCents: number }>,
  method: NonNullable<PersonDto["paymentMethod"]>,
) {
  return people
    .filter((person) => person.paymentMethod === method)
    .reduce((sum, person) => sum + person.amountOwedCents, 0);
}
