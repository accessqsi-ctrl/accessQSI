const test = require("node:test");
const assert = require("node:assert/strict");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mockPackage,
    mountRouter,
    request
} = require("./helpers/http");

const loadQrManagementApp = ({ user, eventService, qrService, qrcode = {}, cardTemplateService = {}, customCardTemplateService = {} }) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/services/event.service", eventService);
    mockModule("src/services/qr.service", qrService);
    mockModule("src/services/card_template.service", {
        hasTemplate: () => false,
        cardExistsForToken: () => false,
        cardUrlForToken: (token) => `/cards/card_${token}.svg`,
        generateCardForQr: async () => null,
        ...cardTemplateService
    });
    mockModule("src/services/custom_card_template.service", {
        resolveCustomForRender: async () => null,
        getDefaultForOrg: async () => "",
        ...customCardTemplateService
    });
    mockModule("src/controllers/api.qr_verify.controller", {
        verifyScan: (req, res) => res.json({ success: true })
    });
    mockPackage("qrcode", {
        toFile: async () => {},
        ...qrcode
    });

    const router = require("../src/routes/qr.routes");
    return mountRouter("/qr", router);
};

test("POST /qr/generate/:event_id validates required holder fields", async () => {
    let createCalled = false;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert" })
        },
        qrService: {
            createQr: async () => {
                createCalled = true;
            }
        }
    });

    const res = await request(app, "POST", "/qr/generate/5", {
        accessType: "single"
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(createCalled, false);
});

test("POST /qr/generate/:event_id creates QR data for an event in the user's organization", async () => {
    let eventLookup = null;
    let createdData = null;
    let qrFileArgs = null;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async (orgId, eventId) => {
                eventLookup = { orgId, eventId };
                return { event_id: eventId, title: "Concert" };
            }
        },
        qrService: {
            createQr: async (data) => {
                createdData = data;
                return { qr_id: 9, ...data };
            }
        },
        qrcode: {
            toFile: async (...args) => {
                qrFileArgs = args;
            }
        }
    });

    const res = await request(app, "POST", "/qr/generate/5", {
        fullName: "Jane Holder",
        email: "jane@example.com",
        phone: "+243000",
        accessType: "multi",
        limit: "3",
        level: "2"
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.deepEqual(eventLookup, { orgId: 42, eventId: 5 });
    assert.equal(createdData.holder_name, "Jane Holder");
    assert.equal(createdData.usage_limit, 3);
    assert.equal(createdData.level, 2);
    assert.equal(createdData.event_id, 5);
    assert.match(res.body.qrUrl, /^\/qrcodes\/qr_.+\.png$/);
    assert.match(qrFileArgs[0], /qr_.+\.png$/);
    assert.equal(JSON.parse(qrFileArgs[1]).e, 5);
});

test("POST /qr/generate/:event_id rejects unknown card templates", async () => {
    let createCalled = false;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert" })
        },
        qrService: {
            createQr: async () => {
                createCalled = true;
            }
        },
        cardTemplateService: {
            hasTemplate: () => false
        }
    });

    const res = await request(app, "POST", "/qr/generate/5", {
        fullName: "Jane Holder",
        accessType: "single",
        cardTemplateId: "unknown-template"
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(createCalled, false);
});

test("POST /qr/generate/:event_id can generate a card from a selected template", async () => {
    let cardArgs = null;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async (orgId, eventId) => ({ event_id: eventId, title: "Concert" })
        },
        qrService: {
            createQr: async (data) => ({ qr_id: 9, ...data })
        },
        cardTemplateService: {
            hasTemplate: (templateId) => templateId === "event-ticket",
            generateCardForQr: async (args) => {
                cardArgs = args;
                return "/cards/card-token.svg";
            }
        }
    });

    const res = await request(app, "POST", "/qr/generate/5", {
        fullName: "Jane Holder",
        accessType: "single",
        cardTemplateId: "event-ticket",
        cardMessage: "Accès VIP"
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.cardUrl, "/cards/card-token.svg");
    assert.equal(cardArgs.templateId, "event-ticket");
    assert.equal(cardArgs.cardMessage, "Accès VIP");
    assert.equal(cardArgs.qrRecord.holder_name, "Jane Holder");
    assert.match(cardArgs.qrUrl, /^\/qrcodes\/qr_.+\.png$/);
});

test("POST /qr/generate/:event_id can generate a card from a custom template", async () => {
    let cardArgs = null;
    const customTemplate = {
        baseTemplateId: "event-ticket",
        customization: {
            title: "INVITÉ OFFICIEL",
            primaryColor: "#123456",
            secondaryColor: "#ddeeff",
            visibleFields: { holder: true, event: true, qr: true },
            layoutConfig: {
                version: 2,
                elements: [
                    { type: "event", x: 100, y: 100, width: 500, height: 80, fontSize: 42, fontWeight: "900", color: "#123456", align: "left", visible: true },
                    { type: "qr", x: 1200, y: 120, width: 240, height: 240, fontSize: 20, fontWeight: "700", color: "#111827", align: "left", visible: true }
                ]
            }
        }
    };
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async (orgId, eventId) => ({ event_id: eventId, title: "Concert" })
        },
        qrService: {
            createQr: async (data) => ({ qr_id: 9, ...data })
        },
        cardTemplateService: {
            hasTemplate: (templateId) => templateId === "event-ticket",
            generateCardForQr: async (args) => {
                cardArgs = args;
                return "/cards/card-custom.svg";
            }
        },
        customCardTemplateService: {
            resolveCustomForRender: async (orgId, templateId) => {
                assert.equal(orgId, 42);
                assert.equal(templateId, "custom:12");
                return customTemplate;
            }
        }
    });

    const res = await request(app, "POST", "/qr/generate/5", {
        fullName: "Jane Holder",
        accessType: "single",
        cardTemplateId: "custom:12",
        cardData: {
            spouseOne: "Nom 1",
            spouseTwo: "Nom 2",
            zone: "Salle",
            address: "Adresse"
        }
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.cardUrl, "/cards/card-custom.svg");
    assert.equal(cardArgs.templateId, "event-ticket");
    assert.deepEqual(cardArgs.customization, customTemplate);
    assert.equal(cardArgs.customization.customization.layoutConfig.version, 2);
    assert.deepEqual(cardArgs.cardData, {
        spouseOne: "Nom 1",
        spouseTwo: "Nom 2",
        zone: "Salle",
        address: "Adresse"
    });
});

test("POST /qr/card/:id generates a card for an existing QR in the user's organization", async () => {
    let cardArgs = null;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async (orgId, eventId) => ({ event_id: eventId, title: "Concert" })
        },
        qrService: {
            getQrById: async () => ({
                qr_id: 10,
                event_id: 5,
                unique_token: "token-10",
                holder_name: "Jane Holder",
                status: "active",
                scans_count: 0,
                usage_limit: 1,
                deleted_at: null
            })
        },
        cardTemplateService: {
            hasTemplate: (templateId) => templateId === "staff-card",
            generateCardForQr: async (args) => {
                cardArgs = args;
                return "/cards/card-token-10.svg";
            }
        }
    });

    const res = await request(app, "POST", "/qr/card/10", {
        cardTemplateId: "staff-card",
        cardMessage: "Badge staff"
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.cardUrl, "/cards/card-token-10.svg");
    assert.equal(cardArgs.templateId, "staff-card");
    assert.equal(cardArgs.cardMessage, "Badge staff");
    assert.equal(cardArgs.qrRecord.unique_token, "token-10");
});

test("POST /qr/card/:id rejects unknown card templates", async () => {
    let lookupCalled = false;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {},
        qrService: {
            getQrById: async () => {
                lookupCalled = true;
            }
        },
        cardTemplateService: {
            hasTemplate: () => false
        }
    });

    const res = await request(app, "POST", "/qr/card/10", {
        cardTemplateId: "unknown"
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(lookupCalled, false);
});

test("PUT /qr/revoke/:id refuses QR codes outside the user's organization", async () => {
    let updateCalled = false;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async () => null
        },
        qrService: {
            getQrById: async () => ({ qr_id: 10, event_id: 99 }),
            updateQr: async () => {
                updateCalled = true;
            }
        }
    });

    const res = await request(app, "PUT", "/qr/revoke/10");

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(updateCalled, false);
});

test("PUT /qr/revoke/:id revokes QR codes from the user's organization", async () => {
    let updateArgs = null;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert" })
        },
        qrService: {
            getQrById: async () => ({ qr_id: 10, event_id: 5 }),
            updateQr: async (...args) => {
                updateArgs = args;
            }
        }
    });

    const res = await request(app, "PUT", "/qr/revoke/10");

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(updateArgs, [10, { status: "revoked" }]);
});

test("PUT /qr/restore/:id restores a revoked QR that is still valid", async () => {
    let updateArgs = null;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert" })
        },
        qrService: {
            getQrById: async () => ({
                qr_id: 10,
                event_id: 5,
                status: "revoked",
                scans_count: 0,
                usage_limit: 1,
                valid_until: new Date(Date.now() + 60_000),
                deleted_at: null
            }),
            updateQr: async (...args) => {
                updateArgs = args;
            }
        }
    });

    const res = await request(app, "PUT", "/qr/restore/10");

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(updateArgs, [10, { status: "active" }]);
});

test("PUT /qr/restore/:id refuses expired revoked QR codes", async () => {
    let updateCalled = false;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert" })
        },
        qrService: {
            getQrById: async () => ({
                qr_id: 10,
                event_id: 5,
                status: "revoked",
                scans_count: 0,
                usage_limit: 1,
                valid_until: new Date(Date.now() - 60_000),
                deleted_at: null
            }),
            updateQr: async () => {
                updateCalled = true;
            }
        }
    });

    const res = await request(app, "PUT", "/qr/restore/10");

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(updateCalled, false);
});

test("PUT /qr/restore/:id refuses QR codes outside the user's organization", async () => {
    let updateCalled = false;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async () => null
        },
        qrService: {
            getQrById: async () => ({
                qr_id: 10,
                event_id: 99,
                status: "revoked",
                scans_count: 0,
                usage_limit: 1,
                valid_until: null,
                deleted_at: null
            }),
            updateQr: async () => {
                updateCalled = true;
            }
        }
    });

    const res = await request(app, "PUT", "/qr/restore/10");

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(updateCalled, false);
});

test("POST /qr/import/:event_id rejects requests without a CSV file", async () => {
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert" })
        },
        qrService: {}
    });

    const res = await request(app, "POST", "/qr/import/5", {});

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
});

test("GET /qr/template/:event_id downloads a CSV import template for an event in the user's organization", async () => {
    let eventLookup = null;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async (orgId, eventId) => {
                eventLookup = { orgId, eventId };
                return { event_id: eventId, title: "Concert" };
            }
        },
        qrService: {}
    });

    const res = await request(app, "GET", "/qr/template/5");

    assert.equal(res.status, 200);
    assert.deepEqual(eventLookup, { orgId: 42, eventId: 5 });
    assert.match(res.headers["content-type"], /text\/csv/);
    assert.equal(res.headers["content-disposition"], 'attachment; filename="modele_import_qr_evenement_5.csv"');
    assert.equal(res.body, "fullName,email,phone,accessType,limit,validFrom,validUntil,level,cardTemplateId,cardMessage\n");
});
