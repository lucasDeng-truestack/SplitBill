export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  OVER_ALLOCATION: "OVER_ALLOCATION",
  INVALID_QUANTITY: "INVALID_QUANTITY",
  INVALID_STATUS: "INVALID_STATUS",
  PARSE_FAILED: "PARSE_FAILED",
  UNASSIGNED_REMAINING: "UNASSIGNED_REMAINING",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ApiErrorBody = {
  error: {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
  };
};
