import type { CreateAssignmentBody } from "@splitbill/shared";
import { ERROR_CODES } from "@splitbill/shared";
import { InvalidQuantityError, InvalidStatusError, NotFoundError, OverAllocationError } from "../errors.js";
import { claimItem } from "../domain/claim.js";
import { logger } from "../logger.js";
import { prisma } from "../prisma.js";
import { toAssignmentDto } from "../mappers/receipt-mapper.js";

export async function claimAssignment(receiptId: string, body: CreateAssignmentBody) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { items: true, people: true },
  });
  if (!receipt) throw new NotFoundError("Receipt not found");
  if (receipt.status === "COMPLETED") {
    throw new InvalidStatusError("Cannot assign items on a completed receipt");
  }

  const person = receipt.people.find((row) => row.id === body.personId);
  if (!person) throw new NotFoundError("Person not found");
  const item = receipt.items.find((row) => row.id === body.itemId);
  if (!item) throw new NotFoundError("Item not found");

  try {
    claimItem({ item, quantity: body.quantity });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_QUANTITY") throw new InvalidQuantityError();
    if (code === "OVER_ALLOCATION") throw new OverAllocationError();
    throw error;
  }

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      // Compare against the row's quantity at write time, so a concurrent review save that
      // lowers the quantity can't leave assignedQuantity above it.
      const updated = await tx.$executeRaw`
        UPDATE "ReceiptItem"
        SET "assignedQuantity" = "assignedQuantity" + ${body.quantity}
        WHERE "id" = ${body.itemId} AND "assignedQuantity" + ${body.quantity} <= "quantity"
      `;
      if (updated !== 1) {
        throw new OverAllocationError();
      }

      return tx.itemAssignment.upsert({
        where: { personId_itemId: { personId: body.personId, itemId: body.itemId } },
        create: {
          receiptId,
          personId: body.personId,
          itemId: body.itemId,
          quantity: body.quantity,
        },
        update: { quantity: { increment: body.quantity } },
      });
    });

    if (receipt.status === "REVIEW") {
      await prisma.receipt.update({
        where: { id: receiptId },
        data: { status: "COLLECTING" },
      });
    }

    logger.info(
      { receiptId, personId: body.personId, itemId: body.itemId, quantity: body.quantity },
      "item assigned",
    );
    return toAssignmentDto(assignment);
  } catch (error) {
    if (error instanceof OverAllocationError) throw error;
    logger.error({ err: error, receiptId }, "assignment failed");
    throw error;
  }
}

export async function deleteAssignment(receiptId: string, assignmentId: string) {
  const assignment = await prisma.itemAssignment.findFirst({
    where: { id: assignmentId, receiptId },
  });
  if (!assignment) throw new NotFoundError("Assignment not found");

  await prisma.$transaction([
    prisma.receiptItem.update({
      where: { id: assignment.itemId },
      data: { assignedQuantity: { decrement: assignment.quantity } },
    }),
    prisma.itemAssignment.delete({ where: { id: assignmentId } }),
  ]);
}

export { ERROR_CODES };
