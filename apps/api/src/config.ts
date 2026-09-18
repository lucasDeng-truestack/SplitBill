import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(apiRoot, "../..");

loadEnv({ path: path.join(apiRoot, ".env") });
loadEnv({ path: path.join(repoRoot, ".env") });

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

export const isProduction = process.env.NODE_ENV === "production";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

const r2AccountId = process.env.R2_ACCOUNT_ID ?? "";

const webOrigins = (process.env.WEB_ORIGIN ?? (isProduction ? "" : "http://localhost:3030"))
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/u, ""))
  .filter(Boolean);

const onlyLocalhostOrigins =
  webOrigins.length === 0 || webOrigins.every((origin) => origin.includes("localhost"));

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction,
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 4000),
  host: process.env.API_HOST ?? "0.0.0.0",
  webOrigins,
  // First Railway boot often happens before a Vercel URL exists.
  allowVercelPreviews: process.env.ALLOW_VERCEL_PREVIEWS === "true" || (isProduction && onlyLocalhostOrigins),
  databaseUrl: isProduction
    ? required("DATABASE_URL")
    : required("DATABASE_URL", "postgresql://splitbill:splitbill@localhost:5436/splitbill"),
  receiptParser: (process.env.RECEIPT_PARSER ?? "mock") as "mock" | "openai",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_RECEIPT_MODEL ?? "gpt-4o",
  storage: (process.env.STORAGE ?? (isProduction ? "r2" : "local")) as "local" | "r2",
  uploadDir: process.env.UPLOAD_DIR ?? path.join(apiRoot, "uploads"),
  r2: {
    accountId: r2AccountId,
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET ?? "",
    endpoint: process.env.R2_ENDPOINT || (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : ""),
  },
};

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/u, "");
  if (config.webOrigins.includes(normalized)) return true;
  if (config.allowVercelPreviews && /^https:\/\/[a-z0-9-]+\.vercel\.app$/iu.test(normalized)) return true;
  return false;
}

export function assertProductionConfig(): void {
  if (!isProduction) return;
  if (config.receiptParser !== "openai" || !config.openaiApiKey) {
    throw new Error("Production requires RECEIPT_PARSER=openai and OPENAI_API_KEY");
  }
  if (config.storage !== "r2") {
    throw new Error("Production requires STORAGE=r2");
  }
  if (!config.r2.accountId || !config.r2.accessKeyId || !config.r2.secretAccessKey || !config.r2.bucket || !config.r2.endpoint) {
    throw new Error("Production requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET");
  }
}
