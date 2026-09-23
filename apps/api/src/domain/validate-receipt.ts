import {
  centsToMajor,
  majorToCents,
  parsedReceiptSchema,
  type ParsedReceipt,
  type ParsedReceiptItem,
  type ValidationIssue,
} from "@splitbill/shared";

const LINE_TOLERANCE_CENTS = 2;
const TOTAL_TOLERANCE_CENTS = 2;
const MAX_INFERRED_QTY = 20;

export function validateParsedReceipt(input: unknown): {
  receipt: ParsedReceipt;
  issues: ValidationIssue[];
} {
  const receipt = parsedReceiptSchema.parse(input);
  const issues: ValidationIssue[] = [];

  receipt.items.forEach((item, index) => {
    if (item.quantity <= 0) {
      issues.push({
        code: "NON_POSITIVE_QUANTITY",
        message: `${item.name} has a non-positive quantity`,
        path: `items.${index}.quantity`,
      });
    }
    const expected = item.quantity * majorToCents(item.unitPrice);
    const actual = majorToCents(item.totalPrice);
    if (Math.abs(expected - actual) > LINE_TOLERANCE_CENTS) {
      issues.push({
        code: "LINE_TOTAL_MISMATCH",
        message: `${item.name}: quantity × unit price (RM ${centsToMajor(expected)}) does not match line total (RM ${centsToMajor(actual)})`,
        path: `items.${index}.totalPrice`,
      });
    }
  });

  const itemSum = sumItemCents(receipt);
  if (receipt.total != null) {
    const reconstructed = reconstructedTotalCents(receipt, itemSum);
    const actualTotal = majorToCents(receipt.total);
    if (Math.abs(reconstructed - actualTotal) > TOTAL_TOLERANCE_CENTS) {
      issues.push({
        code: "RECEIPT_TOTAL_MISMATCH",
        message: `Item totals plus charges (RM ${centsToMajor(reconstructed)}) do not match receipt total (RM ${centsToMajor(actualTotal)})`,
        path: "total",
      });
    }
  }

  if (receipt.subtotal != null) {
    const subtotal = majorToCents(receipt.subtotal);
    if (Math.abs(subtotal - itemSum) > TOTAL_TOLERANCE_CENTS) {
      issues.push({
        code: "SUBTOTAL_MISMATCH",
        message: `Subtotal (RM ${centsToMajor(subtotal)}) does not match sum of item totals (RM ${centsToMajor(itemSum)})`,
        path: "subtotal",
      });
    }
  }

  return { receipt, issues };
}

export function reconcileParsedReceipt(receipt: ParsedReceipt): ParsedReceipt {
  return {
    ...receipt,
    items: receipt.items.map(reconcileLine),
  };
}

export function needsParseRepair(issues: ValidationIssue[]): boolean {
  return issues.some(
    (issue) =>
      issue.code === "RECEIPT_TOTAL_MISMATCH" ||
      issue.code === "LINE_TOTAL_MISMATCH" ||
      issue.code === "SUBTOTAL_MISMATCH",
  );
}

export function receiptDeltaCents(receipt: ParsedReceipt): number {
  if (receipt.total == null) return Number.POSITIVE_INFINITY;
  return Math.abs(reconstructedTotalCents(receipt) - majorToCents(receipt.total));
}

function reconcileLine(item: ParsedReceiptItem): ParsedReceiptItem {
  const unit = majorToCents(item.unitPrice);
  const total = majorToCents(item.totalPrice);
  const qty = item.quantity;
  if (unit <= 0 || total <= 0) return item;
  if (Math.abs(qty * unit - total) <= LINE_TOLERANCE_CENTS) return item;

  // Qty was read, but unit price was actually the line total (3.60 × 2 = 7.20).
  if (qty >= 2 && total % qty === 0) {
    const inferredUnit = total / qty;
    if (inferredUnit > 0 && Math.abs(qty * inferredUnit - total) <= LINE_TOLERANCE_CENTS) {
      return { ...item, unitPrice: inferredUnit / 100 };
    }
  }

  // Unit and line total were read, but qty collapsed to 1 (2.80 × 2 = 5.60).
  if (total % unit === 0) {
    const inferredQty = total / unit;
    if (inferredQty >= 2 && inferredQty <= MAX_INFERRED_QTY) {
      return { ...item, quantity: inferredQty };
    }
  }

  return item;
}

function sumItemCents(receipt: ParsedReceipt): number {
  return receipt.items.reduce((sum, item) => sum + majorToCents(item.totalPrice), 0);
}

function reconstructedTotalCents(receipt: ParsedReceipt, itemSum = sumItemCents(receipt)): number {
  return (
    itemSum +
    majorToCents(receipt.serviceCharge ?? 0) +
    majorToCents(receipt.tax ?? 0) -
    majorToCents(receipt.discount ?? 0) +
    majorToCents(receipt.rounding ?? 0)
  );
}
