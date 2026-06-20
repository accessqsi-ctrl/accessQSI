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
