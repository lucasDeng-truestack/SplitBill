import type { ParsedReceipt } from "@splitbill/shared";
import type { ReceiptImage, ReceiptParser } from "./types.js";

export const MOCK_RECEIPT: ParsedReceipt = {
  items: [
    { name: "Roti telur", quantity: 2, unitPrice: 4, totalPrice: 8 },
    { name: "Roti kosong", quantity: 1, unitPrice: 1.7, totalPrice: 1.7 },
    { name: "Nasi lemak", quantity: 1, unitPrice: 5, totalPrice: 5 },
  ],
  subtotal: 14.7,
  total: 14.7,
  currency: "MYR",
};

export class MockReceiptParser implements ReceiptParser {
  readonly provider = "mock";

  async parseReceipt(_input: ReceiptImage): Promise<ParsedReceipt> {
    return structuredClone(MOCK_RECEIPT);
  }
}
