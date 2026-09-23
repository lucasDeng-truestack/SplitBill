import type { ParsedReceipt } from "@splitbill/shared";

export type ReceiptImage = {
  bytes: Buffer;
  mimeType: string;
  filename?: string;
};

export type ReceiptParseInput = ReceiptImage | ReceiptImage[];

export function asReceiptImages(input: ReceiptParseInput): ReceiptImage[] {
  return Array.isArray(input) ? input : [input];
}

export interface ReceiptParser {
  readonly provider: string;
  parseReceipt(input: ReceiptParseInput): Promise<ParsedReceipt>;
}
