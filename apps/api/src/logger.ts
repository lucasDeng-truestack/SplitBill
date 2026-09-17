import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

export const logger = pino({
  level,
  redact: {
    paths: [
      "req.headers.authorization",
      "OPENAI_API_KEY",
      "*.apiKey",
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
