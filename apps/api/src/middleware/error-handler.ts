import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ERROR_CODES } from "@splitbill/shared";
import { AppError } from "../errors.js";
import { logger } from "../logger.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Invalid request",
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  logger.error({ err }, "unhandled error");
  res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Something went wrong",
    },
  });
}
