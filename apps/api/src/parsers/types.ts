import type { ParsedReceipt } from "@splitbill/shared";

export type ReceiptImage = {
  bytes: Buffer;
  mimeType: string;
  filename?: string;
};

export interface ReceiptParser {
  readonly provider: string;
  parseReceipt(input: ReceiptImage): Promise<ParsedReceipt>;
}
