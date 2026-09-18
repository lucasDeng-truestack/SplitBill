import {
  majorToCents,
  receiptRangeStart,
  type CreateItemBody,
  type PatchReceiptBody,
  type ReceiptListRange,
} from "@splitbill/shared";
import type { ReceiptStatus } from "@prisma/client";
import { InvalidStatusError, NotFoundError, ParseFailedError } from "../errors.js";
import { logger } from "../logger.js";
import { prisma } from "../prisma.js";
import { validateParsedReceipt } from "../domain/validate-receipt.js";
import { createReceiptParser } from "../parsers/factory.js";
import { toReceiptDto, toReceiptListItemDto } from "../mappers/receipt-mapper.js";
import { createObjectStorage, receiptObjectKey } from "../storage/index.js";

const receiptInclude = {
  items: true,
  people: true,
  assignments: true,
} as const;

async function getReceiptOrThrow(id: string) {
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: receiptInclude,
  });
  if (!receipt) throw new NotFoundError("Receipt not found");
  return receipt;
}

export async function listReceipts(range: ReceiptListRange = "all") {
  const createdAtGte = receiptRangeStart(range);
  const receipts = await prisma.receipt.findMany({
    where: createdAtGte ? { createdAt: { gte: createdAtGte } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      people: { orderBy: { sortOrder: "asc" }, select: { name: true } },
      items: { select: { quantity: true, assignedQuantity: true } },
    },
  });
  return receipts.map(toReceiptListItemDto);
}

export async function deleteReceipts(range: ReceiptListRange = "all") {
  const createdAtGte = receiptRangeStart(range);
  const where = createdAtGte ? { createdAt: { gte: createdAtGte } } : {};
  const doomed = await prisma.receipt.findMany({
    where,
    select: { id: true, imagePath: true },
  });
  const deleted = await prisma.receipt.deleteMany({ where });
  const storage = createObjectStorage();
  await Promise.all(
    doomed.map(async (row) => {
      if (!row.imagePath) return;
      await storage.delete(row.imagePath);
    }),
  );
  logger.info({ range, deleted: deleted.count }, "receipts cleared");
  return { deleted: deleted.count };
}

export async function getReceipt(id: string) {
  return toReceiptDto(await getReceiptOrThrow(id));
}

export async function createManualReceipt() {
  const receipt = await prisma.receipt.create({
    data: {
      status: "REVIEW",
      currency: "MYR",
      parserProvider: "manual",
      validationIssues: [],
    },
    include: receiptInclude,
  });
  logger.info({ receiptId: receipt.id }, "manual receipt created");
  return toReceiptDto(receipt);
}

export async function createReceiptFromImage(file: { buffer: Buffer; mimetype: string; originalname: string }) {
  logger.info(
    { mimeType: file.mimetype, size: file.buffer.length, filename: file.originalname },
    "receipt upload received",
  );

  const imagePath = receiptObjectKey(file.originalname);
  await createObjectStorage().put({
    key: imagePath,
    bytes: file.buffer,
    mimeType: file.mimetype,
  });

  const parser = createReceiptParser();
  let parsed;
  try {
    parsed = await parser.parseReceipt({
      bytes: file.buffer,
      mimeType: file.mimetype,
      filename: file.originalname,
    });
  } catch (error) {
    await createObjectStorage().delete(imagePath);
    logger.error({ err: error }, "receipt parsing failed before persistence");
    throw error instanceof ParseFailedError
      ? error
      : new ParseFailedError("Receipt parsing failed");
  }

  const { receipt: valid, issues } = validateParsedReceipt(parsed);
  logger.info({ provider: parser.provider, issueCount: issues.length }, "receipt validation completed");

  const receipt = await prisma.receipt.create({
    data: {
      status: "REVIEW",
      currency: valid.currency ?? "MYR",
      subtotalCents: valid.subtotal != null ? majorToCents(valid.subtotal) : null,
      discountCents: valid.discount != null ? majorToCents(valid.discount) : null,
      serviceChargeCents: valid.serviceCharge != null ? majorToCents(valid.serviceCharge) : null,
      taxCents: valid.tax != null ? majorToCents(valid.tax) : null,
      roundingCents: valid.rounding != null ? majorToCents(valid.rounding) : null,
      totalCents: valid.total != null ? majorToCents(valid.total) : null,
      imagePath,
      parserProvider: parser.provider,
      parserRawJson: valid,
      validationIssues: issues,
      items: {
        create: valid.items.map((item, index) => ({
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: majorToCents(item.unitPrice),
          totalPriceCents: majorToCents(item.totalPrice),
          sortOrder: index,
        })),
      },
    },
    include: receiptInclude,
  });

  logger.info({ receiptId: receipt.id, itemCount: receipt.items.length }, "receipt created");
  return toReceiptDto(receipt);
}

function assertEditable(status: ReceiptStatus) {
  if (status === "COMPLETED") {
    throw new InvalidStatusError("Completed receipts cannot be edited");
  }
}

export async function updateReceipt(id: string, body: PatchReceiptBody) {
  const existing = await getReceiptOrThrow(id);
  assertEditable(existing.status);

  if (body.status === "COLLECTING" && existing.items.length === 0) {
    throw new InvalidStatusError("Add at least one item before collecting");
  }

  const receipt = await prisma.$transaction(async (tx) => {
    if (body.items) {
      await tx.itemAssignment.deleteMany({ where: { receiptId: id } });
      await tx.receiptItem.deleteMany({ where: { receiptId: id } });
      await tx.receiptItem.createMany({
        data: body.items.map((item, index) => ({
          receiptId: id,
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          totalPriceCents: item.totalPriceCents,
          sortOrder: index,
          assignedQuantity: 0,
        })),
      });
    }

    return tx.receipt.update({
      where: { id },
      data: {
        currency: body.currency,
        status: body.status,
        subtotalCents: body.subtotalCents,
        discountCents: body.discountCents,
        serviceChargeCents: body.serviceChargeCents,
        taxCents: body.taxCents,
        roundingCents: body.roundingCents,
        totalCents: body.totalCents,
      },
      include: receiptInclude,
    });
  });

  return toReceiptDto(receipt);
}

export async function addItem(receiptId: string, body: CreateItemBody) {
  const receipt = await getReceiptOrThrow(receiptId);
  assertEditable(receipt.status);
  const created = await prisma.receiptItem.create({
    data: {
      receiptId,
      name: body.name,
      quantity: body.quantity,
      unitPriceCents: body.unitPriceCents,
      totalPriceCents: body.totalPriceCents,
      sortOrder: receipt.items.length,
    },
  });
  return created;
}

export async function updateItem(receiptId: string, itemId: string, body: Partial<CreateItemBody>) {
  const receipt = await getReceiptOrThrow(receiptId);
  assertEditable(receipt.status);
  const item = receipt.items.find((row) => row.id === itemId);
  if (!item) throw new NotFoundError("Item not found");
  if (body.quantity != null && body.quantity < item.assignedQuantity) {
    throw new InvalidStatusError("Quantity cannot be less than already assigned quantity");
  }
  return prisma.receiptItem.update({
    where: { id: itemId },
    data: body,
  });
}

export async function deleteItem(receiptId: string, itemId: string) {
  const receipt = await getReceiptOrThrow(receiptId);
  assertEditable(receipt.status);
  const item = receipt.items.find((row) => row.id === itemId);
  if (!item) throw new NotFoundError("Item not found");
  await prisma.$transaction([
    prisma.itemAssignment.deleteMany({ where: { itemId } }),
    prisma.receiptItem.delete({ where: { id: itemId } }),
  ]);
}
