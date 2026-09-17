import cors from "cors";
import express from "express";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { v1Router } from "./routes/v1.js";

export function createApp() {
  const app = express();
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req: { url?: string }) => req.url === "/health",
      },
    }),
  );
  app.use(cors({ origin: config.webOrigins.length === 1 ? config.webOrigins[0] : config.webOrigins }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/v1", v1Router);
  app.use(errorHandler);
  return app;
}
