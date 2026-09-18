import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import {
  completeReceiptBodySchema,
  createAssignmentBodySchema,
  createItemBodySchema,
  createPersonBodySchema,
  matchQueryBodySchema,
  parseReceiptListRange,
  patchItemBodySchema,
  patchPersonBodySchema,
  patchReceiptBodySchema,
} from "@splitbill/shared";
import { AppError } from "../errors.js";
import { validateBody } from "../middleware/validate.js";
import { matchItems } from "../domain/match.js";
import * as receiptService from "../services/receipt-service.js";
import * as personService from "../services/person-service.js";
import * as assignmentService from "../services/assignment-service.js";
import * as summaryService from "../services/summary-service.js";
import { toItemDto } from "../mappers/receipt-mapper.js";
import { getReceipt } from "../services/receipt-service.js";

function param(req: { params: Record<string, string | string[] | undefined> }, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new AppError("VALIDATION_ERROR", `Missing ${name}`, 400);
  }
  return value;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new AppError("VALIDATION_ERROR", "Receipt upload must be an image", 400));
      return;
    }
    cb(null, true);
  },
});

function queryValue(req: { query: Record<string, unknown> }, name: string): string | undefined {
  const value = req.query[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many receipts. Try again in a few minutes.",
    },
  },
});

export const v1Router = Router();

v1Router.get("/receipts", async (req, res, next) => {
  try {
    const range = parseReceiptListRange(queryValue(req, "range") ?? "all");
    res.json({ receipts: await receiptService.listReceipts(range) });
  } catch (error) {
    next(error);
  }
});

v1Router.delete("/receipts", async (req, res, next) => {
  try {
    const range = parseReceiptListRange(queryValue(req, "range") ?? "all");
    res.json(await receiptService.deleteReceipts(range));
  } catch (error) {
    next(error);
  }
});

v1Router.post("/receipts", uploadLimiter, upload.single("image"), async (req, res, next) => {
  try {
    if (req.body?.manual === "true" || req.body?.manual === true) {
      res.status(201).json({ receipt: await receiptService.createManualReceipt() });
      return;
    }
    if (!req.file) {
      throw new AppError("VALIDATION_ERROR", "image file is required unless creating a manual receipt", 400);
    }
    res.status(201).json({ receipt: await receiptService.createReceiptFromImage(req.file) });
  } catch (error) {
    next(error);
  }
});

v1Router.get("/receipts/:id", async (req, res, next) => {
  try {
    res.json({ receipt: await receiptService.getReceipt(param(req, "id")) });
  } catch (error) {
    next(error);
  }
});

v1Router.patch("/receipts/:id", validateBody(patchReceiptBodySchema), async (req, res, next) => {
  try {
    res.json({ receipt: await receiptService.updateReceipt(param(req, "id"), req.body) });
  } catch (error) {
    next(error);
  }
});

v1Router.post("/receipts/:id/items", validateBody(createItemBodySchema), async (req, res, next) => {
  try {
    const item = await receiptService.addItem(param(req, "id"), req.body);
    res.status(201).json({ item: toItemDto(item) });
  } catch (error) {
    next(error);
  }
});

v1Router.patch("/receipts/:id/items/:itemId", validateBody(patchItemBodySchema), async (req, res, next) => {
  try {
    const item = await receiptService.updateItem(param(req, "id"), param(req, "itemId"), req.body);
    res.json({ item: toItemDto(item) });
  } catch (error) {
    next(error);
  }
});

v1Router.delete("/receipts/:id/items/:itemId", async (req, res, next) => {
  try {
    await receiptService.deleteItem(param(req, "id"), param(req, "itemId"));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

v1Router.post("/receipts/:id/people", validateBody(createPersonBodySchema), async (req, res, next) => {
  try {
    res.status(201).json({ person: await personService.addPerson(param(req, "id"), req.body) });
  } catch (error) {
    next(error);
  }
});

v1Router.patch("/receipts/:id/people/:personId", validateBody(patchPersonBodySchema), async (req, res, next) => {
  try {
    if (req.body.name == null && req.body.paymentMethod === undefined) {
      throw new AppError("VALIDATION_ERROR", "name or paymentMethod is required", 400);
    }
    res.json({ person: await personService.updatePerson(param(req, "id"), param(req, "personId"), req.body) });
  } catch (error) {
    next(error);
  }
});

v1Router.delete("/receipts/:id/people/:personId", async (req, res, next) => {
  try {
    await personService.deletePerson(param(req, "id"), param(req, "personId"));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

v1Router.post("/receipts/:id/assignments", validateBody(createAssignmentBodySchema), async (req, res, next) => {
  try {
    res.status(201).json({ assignment: await assignmentService.claimAssignment(param(req, "id"), req.body) });
  } catch (error) {
    next(error);
  }
});

v1Router.delete("/receipts/:id/assignments/:assignmentId", async (req, res, next) => {
  try {
    await assignmentService.deleteAssignment(param(req, "id"), param(req, "assignmentId"));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

v1Router.post("/receipts/:id/match", validateBody(matchQueryBodySchema), async (req, res, next) => {
  try {
    const receipt = await getReceipt(param(req, "id"));
    res.json({ matches: matchItems(req.body.query, receipt.items) });
  } catch (error) {
    next(error);
  }
});

v1Router.get("/receipts/:id/summary", async (req, res, next) => {
  try {
    res.json({ summary: await summaryService.getSummary(param(req, "id")) });
  } catch (error) {
    next(error);
  }
});

v1Router.post("/receipts/:id/complete", validateBody(completeReceiptBodySchema), async (req, res, next) => {
  try {
    res.json({ summary: await summaryService.completeReceipt(param(req, "id"), req.body.allowUnassigned) });
  } catch (error) {
    next(error);
  }
});
