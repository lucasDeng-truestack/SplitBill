import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(apiRoot, "../..");

loadEnv({ path: path.join(apiRoot, ".env") });
loadEnv({ path: path.join(repoRoot, ".env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  host: process.env.API_HOST ?? "0.0.0.0",
  webOrigins: (process.env.WEB_ORIGIN ?? "http://localhost:3030")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  databaseUrl: required("DATABASE_URL", "postgresql://splitbill:splitbill@localhost:5436/splitbill"),
  receiptParser: (process.env.RECEIPT_PARSER ?? "mock") as "mock" | "openai",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_RECEIPT_MODEL ?? "gpt-4o",
  uploadDir: process.env.UPLOAD_DIR ?? new URL("../uploads", import.meta.url).pathname,
};
