const paymentService = require("../services/payment.service");
const logger = require("../utils/logger");

const run = async () => {
    try {
        const applied = await paymentService.applyDueSubscriptionChanges();
        await paymentService.reconcilePendingTransactions();
        if (applied.length > 0) {
            logger.info("subscription.scheduled_changes_applied", { count: applied.length });
        }
    } catch (error) {
        logger.error("subscription.lifecycle_worker_failed", { error });
    }
};

const startSubscriptionLifecycleWorker = () => {
    const configured = Number.parseInt(process.env.SUBSCRIPTION_WORKER_INTERVAL_MS || "", 10);
    const intervalMs = Number.isInteger(configured) && configured >= 15000
        ? configured
        : 60000;
    void run();
    const timer = setInterval(run, intervalMs);
    timer.unref?.();
    return timer;
};

module.exports = { run, startSubscriptionLifecycleWorker };
