export type StoredObject = {
  key: string;
  bytes: Buffer;
  mimeType: string;
};

export interface ObjectStorage {
  put(object: StoredObject): Promise<void>;
  delete(key: string): Promise<void>;
}
