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
import { validateParsedReceipt, reconcileParsedReceipt } from "../domain/validate-receipt.js";
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
    doomed.flatMap((row) => storedImageKeys(row.imagePath).map((key) => storage.delete(key))),
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

export type UploadedReceiptImage = { buffer: Buffer; mimetype: string; originalname: string };

export async function createReceiptFromImage(file: UploadedReceiptImage) {
  return createReceiptFromImages([file]);
}

export async function createReceiptFromImages(files: UploadedReceiptImage[]) {
  if (files.length === 0) {
    throw new ParseFailedError("Receipt photo is required");
  }

  logger.info(
    {
      photoCount: files.length,
      files: files.map((file) => ({ mimeType: file.mimetype, size: file.buffer.length, filename: file.originalname })),
    },
    "receipt upload received",
  );

  const storage = createObjectStorage();
  const imagePaths = await Promise.all(
    files.map(async (file) => {
      const imagePath = receiptObjectKey(file.originalname);
      await storage.put({
        key: imagePath,
        bytes: file.buffer,
        mimeType: file.mimetype,
      });
      return imagePath;
    }),
  );
  const imagePath = imagePaths.join("\n") || null;

  const parser = createReceiptParser();
  let parsed;
  try {
    parsed = await parser.parseReceipt(
      files.map((file) => ({
        bytes: file.buffer,
        mimeType: file.mimetype,
        filename: file.originalname,
      })),
    );
  } catch (error) {
    await Promise.all(imagePaths.map((key) => storage.delete(key)));
    logger.error({ err: error }, "receipt parsing failed before persistence");
    throw error instanceof ParseFailedError
      ? error
      : new ParseFailedError("Receipt parsing failed");
  }

  const { receipt: valid, issues } = validateParsedReceipt(reconcileParsedReceipt(parsed));
  logger.info({ provider: parser.provider, issueCount: issues.length, photoCount: files.length }, "receipt validation completed");

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

  const existingItems = new Map(existing.items.map((item) => [item.id, item]));
  const keptIds = new Set(
    (body.items ?? []).flatMap((item) => (item.id && existingItems.has(item.id) ? [item.id] : [])),
  );
  if (body.items) {
    for (const item of body.items) {
      const current = item.id ? existingItems.get(item.id) : undefined;
      if (!current) continue;
      if (item.quantity < current.assignedQuantity) {
        throw new InvalidStatusError(
          `${current.name} already has ${current.assignedQuantity} claimed. Undo a claim before lowering it.`,
        );
      }
      if (item.unitPriceCents !== current.unitPriceCents && hasPaidClaim(existing, current.id)) {
        throw new InvalidStatusError(
          `Someone already paid for ${current.name}. Undo their claim before changing its price.`,
        );
      }
    }
    const claimedAndRemoved = existing.items.find((item) => !keptIds.has(item.id) && item.assignedQuantity > 0);
    if (claimedAndRemoved) {
      throw new InvalidStatusError(
        `${claimedAndRemoved.name} is already claimed. Undo the claim before removing it.`,
      );
    }
  }

  const receipt = await prisma.$transaction(async (tx) => {
    if (body.items) {
      const removedIds = existing.items.filter((item) => !keptIds.has(item.id)).map((item) => item.id);
      // Conditional writes: a claim that lands after the checks above makes the save fail
      // instead of being dropped or pushing assignedQuantity past quantity.
      if (removedIds.length > 0) {
        const removed = await tx.receiptItem.deleteMany({
          where: { id: { in: removedIds }, assignedQuantity: 0 },
        });
        if (removed.count !== removedIds.length) {
          throw new InvalidStatusError("Someone just claimed a line you removed. Reload and try again.");
        }
      }
      for (const [index, item] of body.items.entries()) {
        const data = {
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          totalPriceCents: item.totalPriceCents,
          sortOrder: index,
        };
        if (item.id && keptIds.has(item.id)) {
          const updated = await tx.receiptItem.updateMany({
            where: { id: item.id, assignedQuantity: { lte: item.quantity } },
            data,
          });
          if (updated.count !== 1) {
            throw new InvalidStatusError(`Someone just claimed more ${item.name}. Reload and try again.`);
          }
        } else {
          await tx.receiptItem.create({ data: { ...data, receiptId: id } });
        }
      }
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
  if (body.unitPriceCents != null && body.unitPriceCents !== item.unitPriceCents && hasPaidClaim(receipt, itemId)) {
    throw new InvalidStatusError(`Someone already paid for ${item.name}. Undo their claim before changing its price.`);
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

function hasPaidClaim(
  receipt: { people: Array<{ id: string; paymentMethod: unknown }>; assignments: Array<{ itemId: string; personId: string }> },
  itemId: string,
) {
  const paidIds = new Set(receipt.people.filter((person) => person.paymentMethod).map((person) => person.id));
  return receipt.assignments.some((assignment) => assignment.itemId === itemId && paidIds.has(assignment.personId));
}

function storedImageKeys(imagePath: string | null): string[] {
  if (!imagePath) return [];
  return imagePath.split("\n").map((key) => key.trim()).filter(Boolean);
}
