import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

export const logger = pino({
  level,
  redact: {
    paths: [
      "req.headers.authorization",
      "OPENAI_API_KEY",
      "R2_SECRET_ACCESS_KEY",
      "R2_ACCESS_KEY_ID",
      "*.apiKey",
      "*.secretAccessKey",
      "*.bytes",
    ],
    remove: true,
  },
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
});
