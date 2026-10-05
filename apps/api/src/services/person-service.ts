import type { CreatePersonBody, PatchPersonBody } from "@splitbill/shared";
import type { Prisma } from "@prisma/client";
import { InvalidStatusError, NotFoundError } from "../errors.js";
import { prisma } from "../prisma.js";
import { allocateCharges } from "../domain/allocate.js";
import { recordPayment, type PaymentState } from "../domain/payment.js";
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

  // One transaction with the person row locked, so two phones tapping Cash/QR at once
  // can't both read the old amounts and overwrite each other.
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Person" WHERE "id" = ${personId} AND "receiptId" = ${receiptId} FOR UPDATE`;
    const person = await tx.person.findFirst({ where: { id: personId, receiptId } });
    if (!person) throw new NotFoundError("Person not found");

    let payment: PaymentState | undefined;
    if (body.paymentMethod === null) {
      payment = { paymentMethod: null, paidCashCents: null, paidQrCents: null };
    } else if (body.paymentMethod !== undefined) {
      payment = recordPayment(person, body.paymentMethod, await amountOwedNow(tx, receiptId, personId));
    }

    return tx.person.update({
      where: { id: personId },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...payment,
      },
    });
  });
  return toPersonDto(updated);
}

async function amountOwedNow(tx: Prisma.TransactionClient, receiptId: string, personId: string) {
  const receipt = await tx.receipt.findUniqueOrThrow({
    where: { id: receiptId },
    include: { items: true, people: true, assignments: true },
  });
  const allocation = allocateCharges(receipt, receipt.items, receipt.people, receipt.assignments);
  return allocation.people.find((row) => row.personId === personId)?.amountOwedCents ?? 0;
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
