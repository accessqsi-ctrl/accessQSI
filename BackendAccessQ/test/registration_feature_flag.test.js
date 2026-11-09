const test = require("node:test");
const assert = require("node:assert/strict");
const { authAs, clearSrcModules, mockModule, mountRouter, request } = require("./helpers/http");

// Chaque route répond avec son nom : on vérifie seulement si le serveur la laisse passer.
const loadApp = () => {
    clearSrcModules();
    const handler = name => (req, res) => res.status(200).json({ route: name });
    const handlers = names => Object.fromEntries(names.map(name => [name, handler(name)]));
    mockModule("src/middleware/authMiddleware", authAs({ user_id: 1, role: "ORG_ADMIN", org_id: 7 }));
    mockModule("src/middleware/attendeeAuthMiddleware", (req, res, next) => next());
    mockModule("src/controllers/api.registration.controller", handlers(["listForms", "createForm", "getForm", "updateForm", "setStatus", "listRegistrations", "retryIssuance", "retryEmail", "getPublicForm", "submit", "status", "download", "recover"]));
    mockModule("src/controllers/api.ticket_payment.controller", handlers(["balance", "payouts", "payoutProviders", "setPayoutAccount", "requestPayout", "cancelPayout", "providers", "checkout"]));
    const routes = require("../src/routes/registration.routes");
    const express = require("express");
    const app = express();
    app.use(express.json());
    app.use("/registration-forms", routes.privateRouter);
    app.use("/public/registrations", routes.publicRouter);
    return app;
};

const withFlag = async (value, run) => {
    const previous = process.env.REGISTRATION_FORMS_ENABLED;
    if (value === undefined) delete process.env.REGISTRATION_FORMS_ENABLED; else process.env.REGISTRATION_FORMS_ENABLED = value;
    try { await run(); }
    finally { if (previous === undefined) delete process.env.REGISTRATION_FORMS_ENABLED; else process.env.REGISTRATION_FORMS_ENABLED = previous; }
};

const gated = [
    ["GET", "/registration-forms"],
    ["POST", "/registration-forms"],
    ["GET", "/registration-forms/3f0c3c9e-0000-4000-8000-000000000000"],
    ["PUT", "/registration-forms/3f0c3c9e-0000-4000-8000-000000000000/status"],
    ["POST", "/registration-forms/3f0c3c9e-0000-4000-8000-000000000000/registrations/r1/retry-issuance"],
    ["GET", "/public/registrations/forms/abc"],
    ["POST", "/public/registrations/forms/abc/submit"],
    ["GET", "/public/registrations/forms/abc/offers/o1/providers"],
    ["POST", "/public/registrations/forms/abc/checkout"],
    ["POST", "/public/registrations/recover"]
];
// Ce qui est déjà vendu ou émis reste accessible même quand la fonctionnalité est coupée.
const alwaysOpen = [
    ["GET", "/registration-forms/balance"],
    ["GET", "/registration-forms/payouts"],
    ["POST", "/registration-forms/payouts"],
    ["GET", "/public/registrations/access/status"],
    ["GET", "/public/registrations/access/download"]
];

test("registration forms and ticket sales are refused by the server while the feature is disabled", async () => {
    for (const value of [undefined, "false", "TRUE-ish"]) {
        await withFlag(value, async () => {
            const app = loadApp();
            for (const [method, url] of gated) {
                const response = await request(app, method, url, {});
                assert.equal(response.status, 404, `${method} ${url} (${value})`);
                assert.equal(response.body.code, "FEATURE_DISABLED");
            }
            for (const [method, url] of alwaysOpen) {
                assert.equal((await request(app, method, url, {})).status, 200, `${method} ${url} (${value})`);
            }
        });
    }
});

test("registration forms are served when the feature is enabled", async () => {
    await withFlag("true", async () => {
        const app = loadApp();
        for (const [method, url] of [...gated, ...alwaysOpen]) {
            assert.equal((await request(app, method, url, {})).status, 200, `${method} ${url}`);
        }
    });
});
