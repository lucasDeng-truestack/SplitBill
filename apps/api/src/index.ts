import { createApp } from "./app.js";
import { assertProductionConfig, config } from "./config.js";
import { logger } from "./logger.js";
import { prisma } from "./prisma.js";

assertProductionConfig();

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  logger.info(
    {
      port: config.port,
      parser: config.receiptParser,
      storage: config.storage,
      hasOpenAiKey: Boolean(config.openaiApiKey),
    },
    "splitbill api listening",
  );
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
