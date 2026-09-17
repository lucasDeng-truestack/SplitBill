import {
  majorToCents,
  parsedReceiptSchema,
  type ParsedReceipt,
  type ValidationIssue,
} from "@splitbill/shared";

const LINE_TOLERANCE_CENTS = 2;
const TOTAL_TOLERANCE_CENTS = 2;

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
        message: `${item.name}: quantity × unit price (${expected}) does not match line total (${actual})`,
        path: `items.${index}.totalPrice`,
      });
    }
  });

  const itemSum = receipt.items.reduce((sum, item) => sum + majorToCents(item.totalPrice), 0);
  if (receipt.total != null) {
    const reconstructed =
      itemSum +
      majorToCents(receipt.serviceCharge ?? 0) +
      majorToCents(receipt.tax ?? 0) -
      majorToCents(receipt.discount ?? 0) +
      majorToCents(receipt.rounding ?? 0);
    const actualTotal = majorToCents(receipt.total);
    if (Math.abs(reconstructed - actualTotal) > TOTAL_TOLERANCE_CENTS) {
      issues.push({
        code: "RECEIPT_TOTAL_MISMATCH",
        message: `Item totals plus charges (${reconstructed}) do not match receipt total (${actualTotal})`,
        path: "total",
      });
    }
  }

  if (receipt.subtotal != null) {
    const subtotal = majorToCents(receipt.subtotal);
    if (Math.abs(subtotal - itemSum) > TOTAL_TOLERANCE_CENTS) {
      issues.push({
        code: "SUBTOTAL_MISMATCH",
        message: `Subtotal (${subtotal}) does not match sum of item totals (${itemSum})`,
        path: "subtotal",
      });
    }
  }

  return { receipt, issues };
}
