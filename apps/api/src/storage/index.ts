import { randomUUID } from "node:crypto";
import path from "node:path";
import { config } from "../config.js";
import { LocalObjectStorage } from "./local.js";
import { R2ObjectStorage } from "./r2.js";
import type { ObjectStorage } from "./types.js";

export type { ObjectStorage, StoredObject } from "./types.js";

let storage: ObjectStorage | undefined;

export function createObjectStorage(): ObjectStorage {
  if (storage) return storage;
  storage = config.storage === "r2" ? new R2ObjectStorage() : new LocalObjectStorage();
  return storage;
}

export function receiptObjectKey(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"].includes(ext) ? ext : ".jpg";
  return `receipts/${randomUUID()}${safeExt}`;
}
