const crypto = require("crypto");
const logger = require("../utils/logger");

const requestLogger = (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
    res.setHeader("x-request-id", req.requestId);

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const meta = {
            request_id: req.requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            status: res.statusCode,
            duration_ms: Math.round(durationMs),
            ip: req.ip,
            user_id: req.user?.user_id,
            org_id: req.user?.org_id
        };

        if (res.statusCode >= 500) {
            logger.error("request.failed", meta);
        } else if (res.statusCode >= 400) {
            logger.warn("request.rejected", meta);
        } else if (durationMs >= Number(process.env.SLOW_REQUEST_MS || 1000)) {
            logger.warn("request.slow", meta);
        } else if (process.env.LOG_REQUESTS === "true") {
            logger.info("request.completed", meta);
        }
    });

    next();
};

module.exports = requestLogger;
