import { ERROR_CODES } from "@splitbill/shared";
import { AppError, InvalidStatusError, NotFoundError } from "../errors.js";
import { allocateCharges } from "../domain/allocate.js";
import { prisma } from "../prisma.js";
import { toSummaryDto } from "../mappers/receipt-mapper.js";

async function loadReceipt(receiptId: string) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { items: true, people: true, assignments: true },
  });
  if (!receipt) throw new NotFoundError("Receipt not found");
  return receipt;
}

export async function getSummary(receiptId: string) {
  const receipt = await loadReceipt(receiptId);
  const allocation = allocateCharges(receipt, receipt.items, receipt.people, receipt.assignments);
  return toSummaryDto(receipt.id, receipt.currency, receipt.status, allocation, receipt.people);
}

export async function completeReceipt(receiptId: string, allowUnassigned: boolean) {
  const receipt = await loadReceipt(receiptId);
  if (receipt.people.length === 0) {
    throw new InvalidStatusError("Add at least one person before finishing");
  }
  const allocation = allocateCharges(receipt, receipt.items, receipt.people, receipt.assignments);
  if (allocation.hasUnassigned && !allowUnassigned) {
    throw new AppError(
      ERROR_CODES.UNASSIGNED_REMAINING,
      "Unassigned items remain. Confirm finish anyway to continue.",
      409,
      { unassignedItems: allocation.unassignedItems },
    );
  }
  await prisma.receipt.update({
    where: { id: receiptId },
    data: { status: "COMPLETED" },
  });
  return toSummaryDto(receipt.id, receipt.currency, "COMPLETED", allocation, receipt.people);
}
