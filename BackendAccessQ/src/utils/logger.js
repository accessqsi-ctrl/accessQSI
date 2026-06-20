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
        name: error.name,
        message: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === "production" ? undefined : error.stack
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
