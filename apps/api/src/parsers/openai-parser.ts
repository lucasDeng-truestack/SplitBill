import { parsedReceiptSchema, type ParsedReceipt } from "@splitbill/shared";
import OpenAI from "openai";
import { config } from "../config.js";
import { ParseFailedError } from "../errors.js";
import { logger } from "../logger.js";
import type { ReceiptImage, ReceiptParser } from "./types.js";

const SYSTEM_PROMPT = `You extract structured data from a photograph of a real receipt.
Read the printed lines in the image. Never invent a generic menu. Never return placeholder food like roti telur, roti kosong, or nasi lemak unless those words are actually printed.

Return JSON only matching this shape:
{
  "items": [{ "name": string, "quantity": integer, "unitPrice": number, "totalPrice": number }],
  "subtotal": number?,
  "discount": number?,
  "serviceCharge": number?,
  "tax": number?,
  "rounding": number?,
  "total": number?,
  "currency": string?
}
Rules:
- Use major currency units (RM 4.50 is 4.5, never 450). Malaysian receipts are MYR.
- Include sold food and drink lines with a quantity and a price.
- Skip marketing, QR codes, thank-you lines, card numbers, order numbers, SST IDs, and “total cup” counts.
- Skip zero-price promo / welcome-offer lines. Skip unpriced modifiers such as “Normal Sugar”; fold them into the drink name only if helpful.
- Rounding 0.00 may be omitted. Map Sub Total and Grand Total when printed.
- Do not invent items that are not on the receipt.
- Omit optional fields you cannot see.
- quantity must be a positive integer.
- Prefer printed names over OCR guesses when possible.`;

async function withRetries<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn({ attempt: i + 1, err: error }, "openai receipt parse attempt failed");
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export class OpenAiReceiptParser implements ReceiptParser {
  readonly provider = "openai";
  private readonly client: OpenAI;

  constructor(apiKey = config.openaiApiKey) {
    if (!apiKey) {
      throw new ParseFailedError("OPENAI_API_KEY is not configured");
    }
    this.client = new OpenAI({ apiKey });
  }

  async parseReceipt(input: ReceiptImage): Promise<ParsedReceipt> {
    const dataUrl = `data:${input.mimeType};base64,${input.bytes.toString("base64")}`;
    logger.info(
      { provider: this.provider, model: config.openaiModel, mimeType: input.mimeType, bytes: input.bytes.length },
      "receipt parsing started",
    );

    try {
      const completion = await withRetries(() =>
        this.client.chat.completions.create({
          model: config.openaiModel,
          response_format: { type: "json_object" },
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract the line items and totals from this receipt photo. Use only what is printed.",
                },
                { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
              ],
            },
          ],
        }),
      );

      const content = completion.choices[0]?.message.content;
      if (!content) {
        throw new ParseFailedError("OpenAI returned an empty receipt payload");
      }
      const parsed = parsedReceiptSchema.parse(JSON.parse(content));
      logger.info(
        { provider: this.provider, itemCount: parsed.items.length, hasTotal: parsed.total != null },
        "receipt parsing succeeded",
      );
      return parsed;
    } catch (error) {
      if (error instanceof ParseFailedError) throw error;
      logger.error({ err: error, provider: this.provider }, "receipt parsing failed");
      throw toParseError(error);
    }
  }
}

function toParseError(error: unknown): ParseFailedError {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();
  if (lower.includes("no credits") || lower.includes("insufficient_quota")) {
    return new ParseFailedError(
      "Your OpenAI account has no credits left. Add billing, then photograph the slip again.",
    );
  }
  if (lower.includes("invalid_api_key") || lower.includes("incorrect api key")) {
    return new ParseFailedError("That OpenAI API key was rejected. Check the API .env and restart.");
  }
  return new ParseFailedError("OpenAI could not read this receipt", {
    reason: error instanceof Error ? error.message : "unknown",
  });
}
