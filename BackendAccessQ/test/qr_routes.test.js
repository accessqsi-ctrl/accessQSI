const test = require("node:test");
const assert = require("node:assert/strict");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mountRouter,
    request
} = require("./helpers/http");

const noopQrController = {
    getAllQrs: (req, res) => res.json({ success: true, qrs: [] }),
    getQrsByEvent: (req, res) => res.json({ success: true, qrs: [] }),
    generateQrForEvent: (req, res) => res.status(201).json({ success: true }),
    importQrsFromCSV: (req, res) => res.status(201).json({ success: true }),
    revokeQr: (req, res) => res.json({ success: true })
};

const loadQrApp = ({ user, qrVerifyService }) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/controllers/api.qr.controller", noopQrController);
    mockModule("src/services/qr_verify.service", qrVerifyService);

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
    event: { org_id: 42 },
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
            recordScan: async (qrId, scannerId, status) => {
                calls.push(["recordScan", qrId, scannerId, status]);
            },
            updateQrStatus: async () => {
                calls.push(["updateQrStatus"]);
            }
        }
    });

    const res = await request(app, "POST", "/qr/verify", { token: "token-1" });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.holder.name, "Jane");
    assert.deepEqual(calls, [
        ["getQrByToken", "token-1"],
        ["recordScan", 1, 7, "authorized"]
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
