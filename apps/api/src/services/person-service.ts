import type { CreatePersonBody, PatchPersonBody } from "@splitbill/shared";
import { InvalidStatusError, NotFoundError } from "../errors.js";
import { prisma } from "../prisma.js";
import { toPersonDto } from "../mappers/receipt-mapper.js";

async function getReceipt(receiptId: string) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { people: true },
  });
  if (!receipt) throw new NotFoundError("Receipt not found");
  if (receipt.status === "COMPLETED") {
    throw new InvalidStatusError("Completed receipts cannot be edited");
  }
  return receipt;
}

export async function addPerson(receiptId: string, body: CreatePersonBody) {
  const receipt = await getReceipt(receiptId);
  const person = await prisma.person.create({
    data: {
      receiptId,
      name: body.name.trim(),
      sortOrder: receipt.people.length,
    },
  });
  return toPersonDto(person);
}

export async function updatePerson(receiptId: string, personId: string, body: PatchPersonBody) {
  await getReceipt(receiptId);
  const person = await prisma.person.findFirst({ where: { id: personId, receiptId } });
  if (!person) throw new NotFoundError("Person not found");
  return toPersonDto(
    await prisma.person.update({
      where: { id: personId },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.paymentMethod !== undefined ? { paymentMethod: body.paymentMethod } : {}),
      },
    }),
  );
}

export async function deletePerson(receiptId: string, personId: string) {
  const receipt = await getReceipt(receiptId);
  const person = receipt.people.find((row) => row.id === personId);
  if (!person) throw new NotFoundError("Person not found");

  await prisma.$transaction(async (tx) => {
    const assignments = await tx.itemAssignment.findMany({ where: { personId } });
    for (const assignment of assignments) {
      await tx.receiptItem.update({
        where: { id: assignment.itemId },
        data: { assignedQuantity: { decrement: assignment.quantity } },
      });
    }
    await tx.itemAssignment.deleteMany({ where: { personId } });
    await tx.person.delete({ where: { id: personId } });
  });
}
