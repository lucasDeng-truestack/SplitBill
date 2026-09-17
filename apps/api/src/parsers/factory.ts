import { config } from "../config.js";
import { ParseFailedError } from "../errors.js";
import { MockReceiptParser } from "./mock-parser.js";
import { OpenAiReceiptParser } from "./openai-parser.js";
import type { ReceiptParser } from "./types.js";

export function createReceiptParser(): ReceiptParser {
  if (config.receiptParser === "openai") {
    if (!config.openaiApiKey) {
      throw new ParseFailedError(
        "Receipt reading isn’t set up yet. Add OPENAI_API_KEY to the API .env, then restart.",
      );
    }
    return new OpenAiReceiptParser();
  }
  return new MockReceiptParser();
}

export type { ReceiptParser } from "./types.js";
