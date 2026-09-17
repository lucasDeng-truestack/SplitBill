import { ERROR_CODES, type ErrorCode } from "@splitbill/shared";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(ERROR_CODES.NOT_FOUND, message, 404);
  }
}

export class OverAllocationError extends AppError {
  constructor(message = "Requested quantity exceeds remaining quantity") {
    super(ERROR_CODES.OVER_ALLOCATION, message, 409);
  }
}

export class InvalidQuantityError extends AppError {
  constructor(message = "Quantity must be greater than zero") {
    super(ERROR_CODES.INVALID_QUANTITY, message, 400);
  }
}

export class InvalidStatusError extends AppError {
  constructor(message = "Receipt is not in a valid status for this action") {
    super(ERROR_CODES.INVALID_STATUS, message, 409);
  }
}

export class ParseFailedError extends AppError {
  constructor(message = "Failed to parse receipt image", details?: unknown) {
    super(ERROR_CODES.PARSE_FAILED, message, 502, details);
  }
}
