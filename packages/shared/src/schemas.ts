import { z } from "zod";

export const receiptStatusSchema = z.enum([
  "PROCESSING",
  "REVIEW",
  "COLLECTING",
  "COMPLETED",
]);

export type ReceiptStatus = z.infer<typeof receiptStatusSchema>;

export const parsedReceiptItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number(),
  totalPrice: z.number(),
});

export const parsedReceiptSchema = z.object({
  items: z.array(parsedReceiptItemSchema).default([]),
  subtotal: z.number().optional(),
  discount: z.number().optional(),
  serviceCharge: z.number().optional(),
  tax: z.number().optional(),
  rounding: z.number().optional(),
  total: z.number().optional(),
  currency: z.string().min(1).optional(),
});

export type ParsedReceiptItem = z.infer<typeof parsedReceiptItemSchema>;
export type ParsedReceipt = z.infer<typeof parsedReceiptSchema>;

export const validationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const centsSchema = z.number().int();
export const optionalCentsSchema = z.number().int().nullable().optional();

export const createItemBodySchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().int().positive(),
  unitPriceCents: centsSchema,
  totalPriceCents: centsSchema,
});

export const patchItemBodySchema = createItemBodySchema.partial();

export const patchReceiptBodySchema = z.object({
  currency: z.string().min(1).max(8).optional(),
  status: receiptStatusSchema.optional(),
  subtotalCents: optionalCentsSchema,
  discountCents: optionalCentsSchema,
  serviceChargeCents: optionalCentsSchema,
  taxCents: optionalCentsSchema,
  roundingCents: optionalCentsSchema,
  totalCents: optionalCentsSchema,
  // Lines with an id update that item in place so claims on it survive a re-save.
  items: z
    .array(createItemBodySchema.extend({ id: z.string().uuid().optional() }))
    .refine(
      (items) => {
        const ids = items.flatMap((item) => (item.id ? [item.id] : []));
        return new Set(ids).size === ids.length;
      },
      { message: "Each line can appear only once" },
    )
    .optional(),
});

export const paymentMethodSchema = z.enum(["CASH", "QR"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const createPersonBodySchema = z.object({
  name: z.string().min(1).max(80),
});

export const patchPersonBodySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  paymentMethod: paymentMethodSchema.nullable().optional(),
});

export const createAssignmentBodySchema = z.object({
  personId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const completeReceiptBodySchema = z.object({
  allowUnassigned: z.boolean().default(false),
});

export const matchQueryBodySchema = z.object({
  query: z.string().min(1).max(200),
});

export const receiptItemDtoSchema = z.object({
  id: z.string(),
  receiptId: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  totalPriceCents: z.number().int(),
  assignedQuantity: z.number().int(),
  remainingQuantity: z.number().int(),
  sortOrder: z.number().int(),
});

export const personDtoSchema = z.object({
  id: z.string(),
  receiptId: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  paymentMethod: paymentMethodSchema.nullable(),
  /** What they handed over when last marked paid; null if unpaid or paid before amounts were recorded. */
  paidCents: z.number().int().nullable(),
});

export const assignmentDtoSchema = z.object({
  id: z.string(),
  receiptId: z.string(),
  personId: z.string(),
  itemId: z.string(),
  quantity: z.number().int(),
});

export const receiptDtoSchema = z.object({
  id: z.string(),
  currency: z.string(),
  status: receiptStatusSchema,
  subtotalCents: z.number().int().nullable(),
  discountCents: z.number().int().nullable(),
  serviceChargeCents: z.number().int().nullable(),
  taxCents: z.number().int().nullable(),
  roundingCents: z.number().int().nullable(),
  totalCents: z.number().int().nullable(),
  imagePath: z.string().nullable(),
  parserProvider: z.string().nullable(),
  validationIssues: z.array(validationIssueSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(receiptItemDtoSchema),
  people: z.array(personDtoSchema),
  assignments: z.array(assignmentDtoSchema),
});

export const receiptListItemDtoSchema = receiptDtoSchema.pick({
  id: true,
  currency: true,
  status: true,
  totalCents: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  itemCount: z.number().int(),
  personCount: z.number().int(),
  peopleNames: z.array(z.string()),
  unassignedItemCount: z.number().int(),
});

export const personLineItemDtoSchema = z.object({
  itemId: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  lineTotalCents: z.number().int(),
});

export const personSummaryDtoSchema = z.object({
  personId: z.string(),
  name: z.string(),
  paymentMethod: paymentMethodSchema.nullable(),
  items: z.array(personLineItemDtoSchema),
  itemSubtotalCents: z.number().int(),
  serviceChargeCents: z.number().int(),
  taxCents: z.number().int(),
  discountCents: z.number().int(),
  roundingCents: z.number().int(),
  amountOwedCents: z.number().int(),
  paidCents: z.number().int().nullable(),
  /** amountOwed − paid for someone already paid: > 0 collect more, < 0 give back, 0 settled or unpaid. */
  balanceCents: z.number().int(),
});

export const unassignedItemDtoSchema = z.object({
  itemId: z.string(),
  name: z.string(),
  remainingQuantity: z.number().int(),
  unitPriceCents: z.number().int(),
  amountCents: z.number().int(),
});

export const billSummaryDtoSchema = z.object({
  receiptId: z.string(),
  currency: z.string(),
  status: receiptStatusSchema,
  people: z.array(personSummaryDtoSchema),
  unassignedItems: z.array(unassignedItemDtoSchema),
  assignedItemSubtotalCents: z.number().int(),
  unassignedItemSubtotalCents: z.number().int(),
  assignedTotalCents: z.number().int(),
  unassignedTotalCents: z.number().int(),
  cashTotalCents: z.number().int(),
  qrTotalCents: z.number().int(),
  unpaidTotalCents: z.number().int(),
  /** Sum of positive balances: more to collect from people already paid. */
  balanceDueCents: z.number().int(),
  /** Sum of negative balances as a positive number: change to give back. */
  balanceRefundCents: z.number().int(),
  receiptTotalCents: z.number().int().nullable(),
  hasUnassigned: z.boolean(),
});

export type ReceiptItemDto = z.infer<typeof receiptItemDtoSchema>;
export type PersonDto = z.infer<typeof personDtoSchema>;
export type AssignmentDto = z.infer<typeof assignmentDtoSchema>;
export type ReceiptDto = z.infer<typeof receiptDtoSchema>;
export type ReceiptListItemDto = z.infer<typeof receiptListItemDtoSchema>;
export type PersonSummaryDto = z.infer<typeof personSummaryDtoSchema>;
export type BillSummaryDto = z.infer<typeof billSummaryDtoSchema>;
export type CreateItemBody = z.infer<typeof createItemBodySchema>;
export type PatchReceiptBody = z.infer<typeof patchReceiptBodySchema>;
export type CreatePersonBody = z.infer<typeof createPersonBodySchema>;
export type PatchPersonBody = z.infer<typeof patchPersonBodySchema>;
export type CreateAssignmentBody = z.infer<typeof createAssignmentBodySchema>;
export type CompleteReceiptBody = z.infer<typeof completeReceiptBodySchema>;
