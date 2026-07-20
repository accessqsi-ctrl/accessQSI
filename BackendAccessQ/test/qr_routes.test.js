const test = require("node:test");
const assert = require("node:assert/strict");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mountRouter,
    request
} = require("./helpers/http");
const { evaluateQrScan } = require("../src/services/qr_policy.service");

const noopQrController = {
    getAllQrs: (req, res) => res.json({ success: true, qrs: [] }),
    getQrsByEvent: (req, res) => res.json({ success: true, qrs: [] }),
    generateQrForEvent: (req, res) => res.status(201).json({ success: true }),
    downloadQrImportTemplate: (req, res) => res.send("fullName,email,phone,accessType,limit,validFrom,validUntil,level\n"),
    importQrsFromCSV: (req, res) => res.status(201).json({ success: true }),
    revokeQr: (req, res) => res.json({ success: true }),
    restoreQr: (req, res) => res.json({ success: true }),
    generateCardForExistingQr: (req, res) => res.status(201).json({ success: true })
};

const loadQrApp = ({ user, qrVerifyService }) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/controllers/api.qr.controller", noopQrController);
    const adaptedService = { ...qrVerifyService };
    if (!adaptedService.verifyAndRecordScan) {
        adaptedService.verifyAndRecordScan = async ({
            token, scannerId, scannerOrgId, areaId, location
        }) => {
            const qr = await adaptedService.getQrByToken(token);
            const decision = evaluateQrScan(qr, scannerOrgId, new Date(), areaId);
            if (decision.shouldRecord) {
                await adaptedService.recordScan(qr.qr_id, scannerId, decision.scanStatus, location, decision.areaId);
            }
            if (decision.success && decision.shouldMarkUsedUp) {
                await adaptedService.updateQrStatus(qr.qr_id, "used_up");
            }
            return { qr, decision };
        };
    }
    mockModule("src/services/qr_verify.service", adaptedService);

    const router = require("../src/routes/qr.routes");
    return mountRouter("/qr", router);
};

const validQr = (overrides = {}) => ({
    qr_id: 1,
    unique_token: "token-1",
    status: "active",
    usage_limit: 2,
    scans_count: 0,
    valid_from: null,
    valid_until: null,
    holder_name: "Jane",
    holder_email: "jane@example.com",
    level: 1,
    deleted_at: null,
    event: { org_id: 42, deleted_at: null, organization: { deleted_at: null, is_active: true } },
    ...overrides
});

test("POST /qr/verify requires a token", async () => {
    const app = loadQrApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
        qrVerifyService: {
            getQrByToken: async () => validQr(),
            recordScan: async () => {},
            updateQrStatus: async () => {}
        }
    });

    const res = await request(app, "POST", "/qr/verify", {});

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
});

test("POST /qr/verify authorizes a valid QR and records the scan", async () => {
    const calls = [];
    const app = loadQrApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
        qrVerifyService: {
            getQrByToken: async (token) => {
                calls.push(["getQrByToken", token]);
                return validQr();
            },
            recordScan: async (qrId, scannerId, status, location) => {
                calls.push(["recordScan", qrId, scannerId, status, location]);
            },
            updateQrStatus: async () => {
                calls.push(["updateQrStatus"]);
            }
        }
    });

    const res = await request(app, "POST", "/qr/verify", {
        token: "token-1",
        location: { latitude: -11.664, longitude: 27.479 }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.holder.name, "Jane");
    assert.deepEqual(calls, [
        ["getQrByToken", "token-1"],
        ["recordScan", 1, 7, "authorized", { latitude: -11.664, longitude: 27.479 }]
    ]);
});

test("POST /qr/verify rejects QR from another organization without recording", async () => {
    let recordCalled = false;
    const app = loadQrApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
        qrVerifyService: {
            getQrByToken: async () => validQr({ event: { org_id: 99 } }),
            recordScan: async () => {
                recordCalled = true;
            },
            updateQrStatus: async () => {}
        }
    });

    const res = await request(app, "POST", "/qr/verify", { token: "token-1" });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(recordCalled, false);
});

test("POST /qr/verify rejects QR from a deleted event without recording", async () => {
    let recordCalled = false;
    const app = loadQrApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
        qrVerifyService: {
            getQrByToken: async () => validQr({
                event: {
                    org_id: 42,
                    deleted_at: new Date("2026-01-01T00:00:00Z"),
                    organization: { deleted_at: null, is_active: true }
                }
            }),
            recordScan: async () => {
                recordCalled = true;
            },
            updateQrStatus: async () => {}
        }
    });

    const res = await request(app, "POST", "/qr/verify", { token: "token-1" });

    assert.equal(res.status, 410);
    assert.equal(res.body.success, false);
    assert.equal(recordCalled, false);
});

test("POST /qr/verify records the selected checkpoint area", async () => {
    let recordArgs = null;
    const now = Date.now();
    const app = loadQrApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
        qrVerifyService: {
            getQrByToken: async () => validQr({
                level: 2,
                event: {
                    org_id: 42,
                    deleted_at: null,
                    organization: { deleted_at: null, is_active: true },
                    EventSchedules: [{
                        id_area: 4,
                        start_date: new Date(now - 60_000),
                        end_date: new Date(now + 60_000),
                        area: { accreditation_level: 2 }
                    }]
                }
            }),
            recordScan: async (...args) => {
                recordArgs = args;
            },
            updateQrStatus: async () => {}
        }
    });

    const res = await request(app, "POST", "/qr/verify", {
        token: "token-1",
        areaId: 4
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(recordArgs[4], 4);
});
