import { parsedReceiptSchema, type ParsedReceipt } from "@splitbill/shared";
import OpenAI from "openai";
import { config } from "../config.js";
import {
  needsParseRepair,
  receiptDeltaCents,
  reconcileParsedReceipt,
  validateParsedReceipt,
} from "../domain/validate-receipt.js";
import { ParseFailedError } from "../errors.js";
import { logger } from "../logger.js";
import { asReceiptImages, type ReceiptImage, type ReceiptParseInput, type ReceiptParser } from "./types.js";

const SYSTEM_PROMPT = `You extract structured data from photograph(s) of a real receipt or guest check.
Read the printed lines. Never invent a generic menu. Never return placeholder food like roti telur, roti kosong, or nasi lemak unless those words are actually printed.

Photos may be sequential pages of ONE long slip. Merge them top-to-bottom in photo order. If the same priced row appears on two overlapping photos, keep it once.

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
- Typical columns: NAME, then a T or D flag (takeaway/dine-in — not a quantity), then PRICE, QTY, TOTAL.
- quantity is the QTY column: a small integer such as 1 or 2. It is never T or D.
- unitPrice is the PRICE column. totalPrice is the TOTAL column. totalPrice must equal quantity × unitPrice.
- Example: Roti Telur Bawang PRICE 3.60 QTY 2 TOTAL 7.20 → quantity 2, unitPrice 3.6, totalPrice 7.2. Do not collapse that to quantity 1 at 6.50 or 7.20.
- Include every sold food and drink row with a price. Long mamak guest checks often have 40–60 items. Do not skip the middle. Do not stop after the first page.
- Skip unpriced section headers such as Kari Ikan, Tak Nak Pedas, Tak Nak Sayur, Sayur Lebih, Ok, Basah, Pedas, Extra Limau, Telur Mata.
- Skip marketing, QR codes, thank-you lines, card numbers, order numbers, SST IDs, “THIS IS NOT A RECEIPT!”, and “total cup” counts.
- Skip zero-price promo / welcome-offer lines. Skip unpriced modifiers such as “Normal Sugar”; fold them into the drink name only if helpful.
- Rounding 0.00 may be omitted. Map Sub Total when printed. The bill total is the printed TOTAL AMOUNT / Grand Total on the last page, not a mid-list running total.
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

  async parseReceipt(input: ReceiptParseInput): Promise<ParsedReceipt> {
    const images = asReceiptImages(input);
    if (images.length === 0) {
      throw new ParseFailedError("Receipt photo is required");
    }

    logger.info(
      {
        provider: this.provider,
        model: config.openaiModel,
        photoCount: images.length,
        bytes: images.reduce((sum, image) => sum + image.bytes.length, 0),
      },
      "receipt parsing started",
    );

    try {
      let best = validateParsedReceipt(reconcileParsedReceipt(await this.extract(images, firstPassPrompt(images.length))));
      if (!needsParseRepair(best.issues)) {
        logger.info(
          { provider: this.provider, itemCount: best.receipt.items.length, hasTotal: best.receipt.total != null },
          "receipt parsing succeeded",
        );
        return best.receipt;
      }

      for (let pass = 1; pass <= 2 && needsParseRepair(best.issues); pass += 1) {
        logger.info(
          {
            provider: this.provider,
            pass,
            itemCount: best.receipt.items.length,
            issues: best.issues.map((issue) => issue.code),
            deltaCents: receiptDeltaCents(best.receipt),
          },
          "receipt totals did not add up; re-reading the slip",
        );
        try {
          const next = validateParsedReceipt(
            reconcileParsedReceipt(await this.extract(images, repairPrompt(best.receipt, best.issues))),
          );
          if (receiptDeltaCents(next.receipt) <= receiptDeltaCents(best.receipt)) {
            best = next;
          } else {
            break;
          }
        } catch (error) {
          logger.warn({ err: error, provider: this.provider, pass }, "receipt repair pass failed; keeping best pass");
          break;
        }
      }

      logger.info(
        {
          provider: this.provider,
          itemCount: best.receipt.items.length,
          hasTotal: best.receipt.total != null,
          deltaCents: receiptDeltaCents(best.receipt),
        },
        "receipt parsing succeeded",
      );
      return best.receipt;
    } catch (error) {
      if (error instanceof ParseFailedError) throw error;
      logger.error({ err: error, provider: this.provider }, "receipt parsing failed");
      throw toParseError(error);
    }
  }

  private async extract(images: ReceiptImage[], instruction: string): Promise<ParsedReceipt> {
    const completion = await withRetries(() =>
      this.client.chat.completions.create({
        model: config.openaiModel,
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 8192,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              ...images.map((image) => ({
                type: "image_url" as const,
                image_url: {
                  url: `data:${image.mimeType};base64,${image.bytes.toString("base64")}`,
                  detail: "high" as const,
                },
              })),
            ],
          },
        ],
      }),
    );

    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new ParseFailedError("OpenAI returned an empty receipt payload");
    }
    if (completion.choices[0]?.finish_reason === "length") {
      throw new ParseFailedError("OpenAI truncated the receipt JSON");
    }
    return parsedReceiptSchema.parse(parseJsonContent(content));
  }
}

function firstPassPrompt(photoCount: number): string {
  const tally =
    "After listing every priced row, add the line totals. If they do not match the printed TOTAL AMOUNT, you missed a row — find it before you reply. Cheap drinks like Ais Kosong 0.30 / 0.60 still count.";
  if (photoCount === 1) {
    return `Extract every priced line item and the printed totals from this receipt photo. Use only what is printed. Read PRICE, QTY and TOTAL as separate columns. ${tally}`;
  }
  return `These ${photoCount} photos are pages of one long receipt, in order from top to bottom. Extract every priced line item across all photos and the printed TOTAL AMOUNT. Use only what is printed. Read PRICE, QTY and TOTAL as separate columns. Do not skip the middle of the slip. ${tally}`;
}

function repairPrompt(receipt: ParsedReceipt, issues: { code: string; message: string }[]): string {
  const names = receipt.items.map((item) => item.name).join(", ");
  return [
    "The first pass still does not add up. Re-read every priced row in the photos from top to bottom.",
    "Fix wrong quantity / unit price / line total triples so quantity × unitPrice equals totalPrice.",
    "Insert any skipped rows, especially cheap drinks and items in the middle of a long guest check.",
    "Do not drop correct rows. Do not invent rows that are not printed.",
    "The printed TOTAL AMOUNT is the bill total.",
    `Issues: ${issues.map((issue) => issue.message).join("; ")}`,
    `Names already found: ${names}`,
    `First pass JSON: ${JSON.stringify(receipt)}`,
    "Return the full corrected JSON with every priced row.",
  ].join("\n");
}

function parseJsonContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }
    throw new ParseFailedError("OpenAI returned invalid receipt JSON");
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
