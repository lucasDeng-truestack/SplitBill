import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { ObjectStorage, StoredObject } from "./types.js";

function resolvePath(key: string): string {
  if (path.isAbsolute(key)) return key;
  return path.join(config.uploadDir, key);
}

export class LocalObjectStorage implements ObjectStorage {
  async put(object: StoredObject): Promise<void> {
    const filePath = resolvePath(object.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, object.bytes);
  }

  async delete(key: string): Promise<void> {
    await unlink(resolvePath(key)).catch((error) => {
      logger.warn({ err: error, key }, "local object delete skipped");
    });
  }
}
