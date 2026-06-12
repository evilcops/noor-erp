import dotenv from "dotenv";
import { appConfig } from "./config/auth.js";
import { connectDatabase } from "./config/database.js";
import { createApp } from "./app.js";
import { ensureDevAdmin } from "./services/bootstrap.service.js";
import { logger } from "./utils/logger.js";

dotenv.config();

async function bootstrap() {
  await connectDatabase();
  await ensureDevAdmin();
  const app = createApp();

  app.listen(appConfig.port, () => {
    logger.info(`NOOR ERP API running on http://localhost:${appConfig.port}`);
    logger.info(`CORS origin: ${appConfig.corsOrigin}`);
  });
}

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  console.error("\n" + message + "\n");
  process.exit(1);
});
