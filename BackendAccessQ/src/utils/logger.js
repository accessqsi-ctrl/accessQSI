const LEVELS = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 99
};

const defaultLevel = () => {
    if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
    if (process.env.NODE_ENV === "test") return "silent";
    return process.env.NODE_ENV === "production" ? "info" : "debug";
};

const currentLevel = () => LEVELS[defaultLevel()] ?? LEVELS.info;

const serializeError = (error) => {
    if (!error) return undefined;

    return {
        name: error.name || error.constructor?.name || "Error",
        message: error.message || String(error),
        code: error.code,
        // Les logs restent côté serveur. La pile est indispensable en production
        // pour retrouver la ligne qui a réellement provoqué une réponse 500.
        stack: process.env.LOG_STACK_TRACES === "false" ? undefined : error.stack,
        client_version: error.clientVersion,
        cause: error.cause instanceof Error
            ? {
                name: error.cause.name,
                message: error.cause.message,
                code: error.cause.code
            }
            : undefined
    };
};

const redact = (value) => {
    if (!value || typeof value !== "object") return value;
    if (value instanceof Error) return serializeError(value);

    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            const lowerKey = key.toLowerCase();
            if (
                lowerKey.includes("password") ||
                lowerKey.includes("token") ||
                lowerKey.includes("secret") ||
                lowerKey.includes("authorization") ||
                lowerKey.includes("cookie") ||
                lowerKey.includes("private_key") ||
                lowerKey.includes("public_key")
            ) {
                return [key, "[redacted]"];
            }

            return [key, item instanceof Error ? serializeError(item) : item];
        })
    );
};

const log = (level, event, meta = {}) => {
    if ((LEVELS[level] ?? LEVELS.info) < currentLevel()) return;

    const entry = {
        ts: new Date().toISOString(),
        level,
        event,
        service: "backend-accessq",
        ...redact(meta)
    };

    const line = JSON.stringify(entry);
    if (level === "error") return console.error(line);
    if (level === "warn") return console.warn(line);
    return console.log(line);
};

module.exports = {
    debug: (event, meta) => log("debug", event, meta),
    info: (event, meta) => log("info", event, meta),
    warn: (event, meta) => log("warn", event, meta),
    error: (event, meta) => log("error", event, meta),
    serializeError
};
