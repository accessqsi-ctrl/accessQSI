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

const loadQrManagementApp = ({ user, eventService, qrService, qrcode = {} }) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/services/event.service", eventService);
    mockModule("src/services/qr.service", qrService);
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
    assert.equal(res.body, "fullName,email,phone,accessType,limit,validFrom,validUntil,level\n");
});
