const test = require("node:test");
const assert = require("node:assert/strict");
const { clearSrcModules, mockModule } = require("./helpers/http");

const response = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

const loadController = registrationService => {
    clearSrcModules();
    const logs = [];
    mockModule("src/services/registration.service", registrationService);
    mockModule("src/services/registration_access.service", { resolveAccessToken: async () => null });
    mockModule("src/services/registration_card.service", { generateRegistrationPassPdf: async () => Buffer.from("") });
    mockModule("src/utils/logger", {
        error: (event, meta) => logs.push({ level: "error", event, meta }),
        warn: (event, meta) => logs.push({ level: "warn", event, meta }),
        info: (event, meta) => logs.push({ level: "info", event, meta })
    });
    return { controller: require("../src/controllers/api.registration.controller"), logs };
};

test("registration controller logs an internal failure with correlation context", async () => {
    const error = Object.assign(new Error("database unavailable"), { code: "P1001" });
    const { controller, logs } = loadController({ createForm: async () => { throw error; } });
    const req = { requestId: "request-42", user: { user_id: 7, org_id: 9 }, body: {}, params: {} };
    const res = response();

    await controller.createForm(req, res);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { success: false, code: "REGISTRATION_ERROR", message: "Erreur serveur", requestId: "request-42" });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].level, "error");
    assert.equal(logs[0].event, "registration.request_failed");
    assert.equal(logs[0].meta.operation, "create_form");
    assert.equal(logs[0].meta.request_id, "request-42");
    assert.equal(logs[0].meta.org_id, 9);
    assert.equal(logs[0].meta.code, "P1001");
    assert.equal(logs[0].meta.error, error);
});

test("registration controller distinguishes an expected business rejection", async () => {
    const error = Object.assign(new Error("Le formulaire est fermé."), { code: "FORM_CLOSED", statusCode: 409 });
    const { controller, logs } = loadController({ submit: async () => { throw error; } });
    const req = { requestId: "request-43", body: { email: "private@example.com" }, params: { slug: "public-form" }, get: () => "submission-key" };
    const res = response();

    await controller.submit(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, "FORM_CLOSED");
    assert.equal(logs[0].level, "warn");
    assert.equal(logs[0].meta.operation, "submit_public_registration");
    assert.doesNotMatch(JSON.stringify(logs[0]), /private@example\.com/);
});

test("registration recovery logs its failure but keeps the anti-enumeration response", async () => {
    const error = new Error("queue unavailable");
    const { controller, logs } = loadController({ queueRecovery: async () => { throw error; } });
    const req = { requestId: "request-44", body: { email: "private@example.com", formSlug: "public-form" }, params: {} };
    const res = response();

    await controller.recover(req, res);

    assert.equal(res.statusCode, 202);
    assert.equal(res.body.success, true);
    assert.equal(logs[0].event, "registration.recovery_queue_failed");
    assert.equal(logs[0].meta.request_id, "request-44");
    assert.doesNotMatch(JSON.stringify(logs[0]), /private@example\.com|public-form/);
});
