require("dotenv").config();
const app = require("./src/app");
const logger = require("./src/utils/logger");
const { startSubscriptionLifecycleWorker } = require("./src/workers/subscription.worker");




// ===== Lancer le serveur =====
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info("server.started", {
    port: PORT,
    node_env: process.env.NODE_ENV || "development"
  });
  startSubscriptionLifecycleWorker();
});
