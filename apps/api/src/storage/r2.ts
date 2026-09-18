import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { ObjectStorage, StoredObject } from "./types.js";

function createClient(): S3Client {
  if (!config.r2.endpoint || !config.r2.accessKeyId || !config.r2.secretAccessKey) {
    throw new Error("R2 storage is not configured");
  }
  return new S3Client({
    region: "auto",
    endpoint: config.r2.endpoint,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export class R2ObjectStorage implements ObjectStorage {
  private readonly client = createClient();
  private readonly bucket = config.r2.bucket;

  async put(object: StoredObject): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: object.key,
        Body: object.bytes,
        ContentType: object.mimeType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    if (key.startsWith("/") || key.includes(":\\")) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      logger.warn({ err: error, key }, "r2 object delete skipped");
    }
  }
}
