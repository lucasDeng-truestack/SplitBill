import type {
  ApiErrorBody,
  BillSummaryDto,
  CreateAssignmentBody,
  CreateItemBody,
  CreatePersonBody,
  PatchPersonBody,
  PatchReceiptBody,
  ReceiptDto,
  ReceiptListItemDto,
  ReceiptListRange,
} from "@splitbill/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Photo uploads on cafe Wi-Fi can be slow; everything else should answer well inside this.
const UPLOAD_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const upload = init?.body instanceof FormData;
  if (init?.body && !upload && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      ...init,
      headers,
      signal: init?.signal ?? AbortSignal.timeout(upload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // A dead connection otherwise leaves the screen waiting forever with the buttons greyed out.
    const timedOut = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ApiError(
      0,
      timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      timedOut ? "That took too long. Check your connection and try again." : "Can’t reach the server. Check your connection and try again.",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const json = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      json.error?.code ?? "INTERNAL_ERROR",
      json.error?.message ?? "Request failed",
      json.error?.details,
    );
  }
  return json;
}

export const api = {
  listReceipts: (range: ReceiptListRange = "all") =>
    request<{ receipts: ReceiptListItemDto[] }>(`/receipts?range=${range}`),
  clearReceipts: (range: ReceiptListRange = "all") =>
    request<{ deleted: number }>(`/receipts?range=${range}`, { method: "DELETE" }),
  getReceipt: (id: string) => request<{ receipt: ReceiptDto }>(`/receipts/${id}`),
  createFromImage: (file: File) => {
    const body = new FormData();
    body.append("images", file, file.name || "receipt.jpg");
    return request<{ receipt: ReceiptDto }>("/receipts", { method: "POST", body });
  },
  createFromImages: (files: File[]) => {
    const body = new FormData();
    files.forEach((file, index) => {
      body.append("images", file, file.name || `receipt-${index + 1}.jpg`);
    });
    return request<{ receipt: ReceiptDto }>("/receipts", { method: "POST", body });
  },
  createManual: () => {
    const body = new FormData();
    body.append("manual", "true");
    return request<{ receipt: ReceiptDto }>("/receipts", { method: "POST", body });
  },
  updateReceipt: (id: string, body: PatchReceiptBody) =>
    request<{ receipt: ReceiptDto }>(`/receipts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  addItem: (id: string, body: CreateItemBody) =>
    request(`/receipts/${id}/items`, { method: "POST", body: JSON.stringify(body) }),
  updateItem: (id: string, itemId: string, body: Partial<CreateItemBody>) =>
    request(`/receipts/${id}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteItem: (id: string, itemId: string) =>
    request(`/receipts/${id}/items/${itemId}`, { method: "DELETE" }),
  addPerson: (id: string, body: CreatePersonBody) =>
    request(`/receipts/${id}/people`, { method: "POST", body: JSON.stringify(body) }),
  updatePerson: (id: string, personId: string, body: PatchPersonBody) =>
    request(`/receipts/${id}/people/${personId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePerson: (id: string, personId: string) =>
    request(`/receipts/${id}/people/${personId}`, { method: "DELETE" }),
  claim: (id: string, body: CreateAssignmentBody) =>
    request(`/receipts/${id}/assignments`, { method: "POST", body: JSON.stringify(body) }),
  deleteAssignment: (id: string, assignmentId: string) =>
    request(`/receipts/${id}/assignments/${assignmentId}`, { method: "DELETE" }),
  getSummary: (id: string) => request<{ summary: BillSummaryDto }>(`/receipts/${id}/summary`),
  complete: (id: string, allowUnassigned: boolean) =>
    request<{ summary: BillSummaryDto }>(`/receipts/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ allowUnassigned }),
    }),
};
