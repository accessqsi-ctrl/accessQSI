// Lance la purge des données personnelles à intervalle régulier (toutes les 6 heures par défaut).
const retention = require("../services/data_retention.service");
const logger = require("../utils/logger");

let running = false;

const run = async () => {
    // Un passage long ne doit pas en chevaucher un autre.
    if (running) return;
    running = true;
    try {
        const { mode, results } = await retention.runRetention();
        if (mode === "off") return;
        const event = mode === "on" ? "data_retention.purged" : "data_retention.dry_run";
        logger.info(event, results);
    } catch (error) {
        logger.error("data_retention.worker_failed", { error });
    } finally {
        running = false;
    }
};

const startDataRetentionWorker = () => {
    const { mode, intervalMs } = retention.getRetentionConfig();
    if (mode === "off") {
        logger.info("data_retention.disabled");
        return null;
    }
    void run();
    const timer = setInterval(run, intervalMs);
    timer.unref?.();
    return timer;
};

module.exports = { run, startDataRetentionWorker };
