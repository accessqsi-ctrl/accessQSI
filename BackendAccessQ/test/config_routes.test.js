const test = require("node:test");
const assert = require("node:assert/strict");
const { clearSrcModules, mountRouter, request } = require("./helpers/http");

test("GET /config/features exposes only the public feature switches", async () => {
    const previous = { pro: process.env.PRO_PAYMENTS_ENABLED, forms: process.env.REGISTRATION_FORMS_ENABLED };
    try {
        process.env.PRO_PAYMENTS_ENABLED = "false";
        process.env.REGISTRATION_FORMS_ENABLED = "true";
        clearSrcModules();
        const app = mountRouter("/config", require("../src/routes/config.routes"));
        const response = await request(app, "GET", "/config/features");
        assert.equal(response.status, 200);
        assert.deepEqual(response.body.features, { proPayments: false, registrationForms: true });
    } finally {
        for (const [key, value] of [["PRO_PAYMENTS_ENABLED", previous.pro], ["REGISTRATION_FORMS_ENABLED", previous.forms]]) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
    }
});
