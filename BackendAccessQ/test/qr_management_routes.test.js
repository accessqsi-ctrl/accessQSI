const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mockPackage,
    mountRouter,
    request
} = require("./helpers/http");

const loadQrManagementApp = ({
    user,
    eventService,
    qrService,
    qrcode = {},
    cardTemplateService = {},
    customCardTemplateService = {},
    storageService = {},
    planContext = { isPro: true, plan: "PRO", planName: "Pro", limits: {}, features: [] }
}) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/services/event.service", eventService);
    mockModule("src/services/qr.service", {
        updateQr: async (id, data) => ({ qr_id: id, ...data }),
        countQrsByEventId: async () => 0,
        ...qrService
    });
    mockModule("src/services/card_template.service", {
        hasTemplate: () => false,
        cardExistsForToken: () => false,
        cardUrlForToken: (token) => `/cards/card_${token}.svg`,
        generateCardForQr: async () => null,
        streamCardsPdf: async ({ output }) => output.end(Buffer.from("%PDF-test")),
        ...cardTemplateService
    });
    mockModule("src/services/custom_card_template.service", {
        resolveCustomForRender: async () => null,
        getDefaultForOrg: async () => "",
        ...customCardTemplateService
    });
    mockModule("src/services/storage.service", {
        storagePath: (...segments) => path.join(os.tmpdir(), ...segments),
        writeFileAtomically: async () => {},
        removeQrAssets: async () => {},
        ...storageService
    });
    mockModule("src/controllers/api.qr_verify.controller", {
        verifyScan: (req, res) => res.json({ success: true })
    });
    mockModule("src/utils/planAccess", {
        getPlanContextForUser: async () => planContext
    });
    mockModule("src/services/organization_quota.service", {
        withEventQrQuota: async ({ create }) => create({})
    });
    mockPackage("qrcode", {
        toBuffer: async () => Buffer.from("png"),
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

    assert.equal(res.status, 422);
    assert.equal(res.body.success, false);
    assert.equal(createCalled, false);
});

test("QR management routes reject operators", async () => {
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "OPERATOR", org_id: 42 },
        eventService: {},
        qrService: {}
    });

    const res = await request(app, "POST", "/qr/generate/5", {
        fullName: "Jane",
        accessType: "single"
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
});

test("GET /qr/event/:event_id lets an organization agent read existing QR codes", async () => {
    let eventLookup = null;
    let qrLookup = null;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
        eventService: {
            findById: async (orgId, eventId) => {
                eventLookup = { orgId, eventId };
                return { event_id: eventId, title: "Concert" };
            }
        },
        qrService: {
            getQrsByEventId: async (orgId, eventId) => {
                qrLookup = { orgId, eventId };
                return {
                    items: [{
                        qr_id: 9,
                        holder_name: "Jane Holder",
                        holder_email: "jane@example.com",
                        holder_phone: null,
                        status: "active",
                        scans_count: 0,
                        usage_limit: 1,
                        unique_token: "token-9",
                        created_at: new Date("2026-01-01T10:00:00Z")
                    }],
                    pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 }
                };
            }
        }
    });

    const res = await request(app, "GET", "/qr/event/5?page=1&pageSize=25");

    assert.equal(res.status, 200);
    assert.deepEqual(eventLookup, { orgId: 42, eventId: 5 });
    assert.deepEqual(qrLookup, { orgId: 42, eventId: 5 });
    assert.equal(res.body.qrs.length, 1);
    assert.equal(res.body.qrs[0].holder, "Jane Holder");
    assert.equal(res.body.pagination.total, 1);
});

test("GET /qr/image/:id generates the PNG on demand without storage", async () => {
    let qrPayload = null;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert" })
        },
        qrService: {
            getQrById: async () => ({
                qr_id: 9,
                event_id: 5,
                unique_token: "token-9",
                holder_name: "Jane Holder",
                deleted_at: null
            })
        },
        qrcode: {
            toBuffer: async payload => {
                qrPayload = JSON.parse(payload);
                return Buffer.from("png-on-demand");
            }
        }
    });

    const res = await request(app, "GET", "/qr/image/9?download=1");

    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "image/png");
    assert.match(res.headers["content-disposition"], /^attachment;/);
    assert.deepEqual(qrPayload, { t: "token-9", e: 5 });
});

test("GET /qr/event/:event_id/cards.pdf streams one card per event QR", async () => {
    let streamedCards = null;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert été", EventSchedules: [] })
        },
        qrService: {
            getAllQrsByEventId: async () => [
                { qr_id: 1, event_id: 5, unique_token: "token-1", holder_name: "Alice", card_template_id: "event-ticket", deleted_at: null },
                { qr_id: 2, event_id: 5, unique_token: "token-2", holder_name: "Bob", card_template_id: "event-ticket", deleted_at: null }
            ]
        },
        cardTemplateService: {
            isTemplateAvailable: id => id === "event-ticket",
            streamCardsPdf: async ({ cards, output }) => {
                streamedCards = cards;
                output.end(Buffer.from("%PDF-on-demand"));
            }
        }
    });

    const res = await request(app, "GET", "/qr/event/5/cards.pdf");

    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "application/pdf");
    assert.equal(res.headers["content-disposition"], 'attachment; filename="badges-Concert-ete.pdf"');
    assert.equal(streamedCards.length, 2);
    assert.equal(streamedCards[0].qrRecord.holder_name, "Alice");
    assert.match(streamedCards[0].qrUrl, /^data:image\/png;base64,/);
});

test("POST /qr/generate/:event_id lets an organization agent create QR data", async () => {
    let eventLookup = null;
    let createdData = null;
    let qrFileArgs = null;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
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
            toBuffer: async (...args) => {
                qrFileArgs = args;
                return Buffer.from("png");
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
    assert.equal(res.body.qrUrl, "/qr/image/9");
    assert.equal(qrFileArgs, null);
});

test("POST /qr/generate/:event_id stores unlimited access with usage_limit zero", async () => {
    let createdData = null;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert" })
        },
        qrService: {
            createQr: async (data) => {
                createdData = data;
                return { qr_id: 9, ...data };
            }
        }
    });

    const res = await request(app, "POST", "/qr/generate/5", {
        fullName: "Jane Holder",
        accessType: "unlimited"
    });

    assert.equal(res.status, 201);
    assert.equal(createdData.usage_limit, 0);
});

test("POST /qr/generate/:event_id does not generate or store an image during creation", async () => {
    const calls = [];
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert" })
        },
        qrService: {
            createQr: async (data) => ({ qr_id: 9, ...data }),
            deleteQrPermanently: async (id) => calls.push(["delete", id])
        },
        qrcode: {
            toBuffer: async () => {
                throw new Error("PNG indisponible");
            }
        },
        storageService: {
            removeQrAssets: async (token) => calls.push(["cleanup", token])
        }
    });

    const res = await request(app, "POST", "/qr/generate/5", {
        fullName: "Jane Holder",
        accessType: "single"
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.qrUrl, "/qr/image/9");
    assert.deepEqual(calls, []);
});

test("POST /qr/generate/:event_id uses centralized validation for limits and dates", async () => {
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
        fullName: "Jane Holder",
        accessType: "multi",
        limit: 0,
        validFrom: "2026-08-02T10:00:00Z",
        validUntil: "2026-08-01T10:00:00Z"
    });

    assert.equal(res.status, 422);
    assert.equal(createCalled, false);
    assert.deepEqual(res.body.errors.map(error => error.field), ["limit", "validUntil"]);
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
    assert.equal(res.body.cardUrl, null);
    assert.equal(res.body.cardPdfUrl, "/qr/card/9/download");
    assert.equal(cardArgs, null);
});

test("POST /qr/generate/:event_id can generate a card from a custom template", async () => {
    let cardArgs = null;
    let createdData = null;
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
            createQr: async (data) => {
                createdData = data;
                return { qr_id: 9, ...data };
            }
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
    assert.equal(res.body.cardUrl, null);
    assert.equal(res.body.cardPdfUrl, "/qr/card/9/download");
    assert.equal(cardArgs, null);
    assert.equal(createdData.card_template_id, "custom:12");
    assert.equal(createdData.card_template_snapshot.schemaVersion, 1);
    assert.equal(createdData.card_template_snapshot.sourceTemplateId, "custom:12");
    assert.equal(createdData.card_template_snapshot.customization.customization.title, "INVITÉ OFFICIEL");
    assert.deepEqual(createdData.card_data, {
        spouseOne: "Nom 1",
        spouseTwo: "Nom 2",
        zone: "Salle",
        address: "Adresse"
    });
});

test("POST /qr/generate/:event_id allows standard templates on the Free plan", async () => {
    let createCalled = false;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        planContext: {
            isPro: false,
            plan: "FREE",
            planName: "Free",
            limits: { maxQrCodes: 100 },
            capabilities: []
        },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert" })
        },
        qrService: {
            createQr: async (data) => {
                createCalled = true;
                return { qr_id: 9, ...data };
            }
        },
        cardTemplateService: {
            isTemplateAvailable: (id) => id === "event-ticket",
            generateCardForQr: async () => "/cards/standard.svg"
        }
    });

    const res = await request(app, "POST", "/qr/generate/5", {
        fullName: "Free Holder",
        accessType: "single",
        cardTemplateId: "event-ticket"
    });

    assert.equal(res.status, 201);
    assert.equal(createCalled, true);
});

test("POST /qr/generate/:event_id rejects custom templates on the Free plan", async () => {
    let createCalled = false;
    let customLookupCalled = false;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        planContext: {
            isPro: false,
            plan: "FREE",
            planName: "Free",
            limits: { maxQrCodes: 100 },
            capabilities: []
        },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert" })
        },
        qrService: {
            createQr: async () => {
                createCalled = true;
            }
        },
        customCardTemplateService: {
            resolveCustomForRender: async () => {
                customLookupCalled = true;
                return null;
            }
        }
    });

    const res = await request(app, "POST", "/qr/generate/5", {
        fullName: "Free Holder",
        accessType: "single",
        cardTemplateId: "custom:8"
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.upgradeRequired, true);
    assert.equal(customLookupCalled, false);
    assert.equal(createCalled, false);
});

test("POST /qr/card/:id rejects a saved custom snapshot after downgrade to Free", async () => {
    let generateCalled = false;
    let updateCalled = false;
    const app = loadQrManagementApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        planContext: {
            isPro: false,
            plan: "FREE",
            planName: "Free",
            limits: { maxQrCodes: 100 },
            capabilities: []
        },
        eventService: {
            findById: async () => ({ event_id: 5, title: "Concert" })
        },
        qrService: {
            getQrById: async () => ({
                qr_id: 10,
                event_id: 5,
                unique_token: "token-10",
                deleted_at: null,
                card_template_id: "custom:12",
                card_template_snapshot: {
                    schemaVersion: 1,
                    sourceTemplateId: "custom:12",
                    baseTemplateId: "event-ticket",
                    customization: { title: "ANCIEN MODÈLE PRO" }
                }
            }),
            updateQr: async () => {
                updateCalled = true;
            }
        },
        cardTemplateService: {
            generateCardForQr: async () => {
                generateCalled = true;
            }
        }
    });

    const res = await request(app, "POST", "/qr/card/10", {});

    assert.equal(res.status, 403);
    assert.equal(res.body.upgradeRequired, true);
    assert.equal(generateCalled, false);
    assert.equal(updateCalled, false);
});

test("POST /qr/card/:id saves the selected template for on-demand generation", async () => {
    let updatedData = null;
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
            }),
            updateQr: async (id, data) => {
                updatedData = { id, data };
                return { qr_id: id, ...data };
            }
        },
        cardTemplateService: {
            hasTemplate: (templateId) => templateId === "staff-card",
            generateCardForQr: async () => {
                throw new Error("La génération persistante ne doit pas être appelée");
            }
        }
    });

    const res = await request(app, "POST", "/qr/card/10", {
        cardTemplateId: "staff-card",
        cardMessage: "Badge staff"
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.cardUrl, null);
    assert.equal(res.body.cardPdfUrl, "/qr/card/10/download");
    assert.equal(updatedData.id, 10);
    assert.equal(updatedData.data.card_template_id, "staff-card");
    assert.equal(updatedData.data.card_generation_status, "ON_DEMAND");
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

test("CSV import returns an explicit report when some lines fail after others were created", async () => {
    clearSrcModules();
    let createCount = 0;
    mockModule("src/services/event.service", {
        findById: async () => ({ event_id: 5, title: "Concert" })
    });
    mockModule("src/services/qr.service", {
        createQr: async (data) => {
            createCount += 1;
            if (createCount === 2) throw new Error("Base indisponible");
            return { qr_id: createCount, ...data };
        },
        updateQr: async () => ({}),
        deleteQrPermanently: async () => ({})
    });
    mockModule("src/services/card_template.service", {
        isTemplateAvailable: () => false,
        generateCardForQr: async () => null
    });
    mockModule("src/services/custom_card_template.service", {
        resolveCustomForRender: async () => null,
        getDefaultForOrg: async () => ""
    });
    mockModule("src/services/storage.service", {
        storagePath: (...segments) => path.join(os.tmpdir(), ...segments),
        writeFileAtomically: async () => {},
        removeQrAssets: async () => {}
    });
    mockModule("src/services/organization_quota.service", {
        withEventQrQuota: async ({ create }) => create({})
    });
    mockPackage("qrcode", { toBuffer: async () => Buffer.from("png") });

    const controller = require("../src/controllers/api.qr.controller");
    const csvPath = path.join(os.tmpdir(), `qr-import-${Date.now()}.csv`);
    fs.writeFileSync(
        csvPath,
        [
            "fullName,accessType,limit,level",
            "Alice,single,,1",
            "Bob,multi,0,1",
            "Cara,single,,1"
        ].join("\n")
    );

    const req = {
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        params: { event_id: "5" },
        file: { path: csvPath }
    };
    const response = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };

    await controller.importQrsFromCSV(req, response);

    assert.equal(response.statusCode, 207);
    assert.equal(response.body.success, true);
    assert.equal(response.body.partial, true);
    assert.equal(response.body.createdCount, 1);
    assert.equal(response.body.completedCount, 1);
    assert.equal(response.body.failedCount, 2);
    assert.equal(response.body.warningCount, 0);
    assert.deepEqual(
        response.body.results.map(result => result.status),
        ["created", "failed", "failed"]
    );
    assert.equal(fs.existsSync(csvPath), false);
});
