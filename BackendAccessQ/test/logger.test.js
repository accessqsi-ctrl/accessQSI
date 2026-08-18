const test = require("node:test");
const assert = require("node:assert/strict");

test("logger redacts sensitive fields in JSON output", async () => {
    const previousLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "info";
    delete require.cache[require.resolve("../src/utils/logger")];
    const logger = require("../src/utils/logger");

    const originalLog = console.log;
    let line = "";
    console.log = (value) => {
        line = value;
    };

    try {
        logger.info("test.event", {
            user_id: 7,
            token: "secret-token",
            password: "secret-password",
            nested: "visible"
        });
    } finally {
        console.log = originalLog;
        if (previousLogLevel === undefined) {
            delete process.env.LOG_LEVEL;
        } else {
            process.env.LOG_LEVEL = previousLogLevel;
        }
        delete require.cache[require.resolve("../src/utils/logger")];
    }

    const entry = JSON.parse(line);
    assert.equal(entry.event, "test.event");
    assert.equal(entry.user_id, 7);
    assert.equal(entry.token, "[redacted]");
    assert.equal(entry.password, "[redacted]");
    assert.equal(entry.nested, "visible");
});

test("logger includes server error details and stack traces in production", () => {
    const previousLogLevel = process.env.LOG_LEVEL;
    const previousNodeEnv = process.env.NODE_ENV;
    const previousStackSetting = process.env.LOG_STACK_TRACES;
    process.env.LOG_LEVEL = "info";
    process.env.NODE_ENV = "production";
    delete process.env.LOG_STACK_TRACES;
    delete require.cache[require.resolve("../src/utils/logger")];
    const logger = require("../src/utils/logger");

    const originalError = console.error;
    let line = "";
    console.error = (value) => {
        line = value;
    };

    try {
        const error = Object.assign(new Error("Database unavailable"), { code: "P1001" });
        logger.error("request.unhandled_error", { request_id: "request-1", error });
    } finally {
        console.error = originalError;
        if (previousLogLevel === undefined) delete process.env.LOG_LEVEL;
        else process.env.LOG_LEVEL = previousLogLevel;
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
        if (previousStackSetting === undefined) delete process.env.LOG_STACK_TRACES;
        else process.env.LOG_STACK_TRACES = previousStackSetting;
        delete require.cache[require.resolve("../src/utils/logger")];
    }

    const entry = JSON.parse(line);
    assert.equal(entry.level, "error");
    assert.equal(entry.error.name, "Error");
    assert.equal(entry.error.message, "Database unavailable");
    assert.equal(entry.error.code, "P1001");
    assert.match(entry.error.stack, /Database unavailable/);
});
