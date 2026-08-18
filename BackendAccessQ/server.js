require("dotenv").config();
const app = require("./src/app");
const logger = require("./src/utils/logger");
const { startSubscriptionLifecycleWorker } = require("./src/workers/subscription.worker");




// ===== Lancer le serveur =====
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info("server.started", {
    port: PORT,
    node_env: process.env.NODE_ENV || "development"
  });
  startSubscriptionLifecycleWorker();
});

server.on("error", (error) => {
  logger.error("server.listen_failed", { port: PORT, error });
});

process.on("unhandledRejection", (error) => {
  logger.error("process.unhandled_rejection", {
    error: error instanceof Error ? error : new Error(String(error))
  });
});

process.on("uncaughtException", (error) => {
  logger.error("process.uncaught_exception", { error });
  process.exitCode = 1;
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 5000).unref();
});
