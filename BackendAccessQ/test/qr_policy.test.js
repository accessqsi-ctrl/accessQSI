const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateQrScan } = require("../src/services/qr_policy.service");

const baseQr = (overrides = {}) => ({
    qr_id: 1,
    status: "active",
    usage_limit: 1,
    scans_count: 0,
    valid_from: null,
    valid_until: null,
    holder_name: "Test Holder",
    event: { org_id: 10 },
    ...overrides
});

test("evaluateQrScan authorizes a valid QR and marks it used up on last allowed scan", () => {
    const decision = evaluateQrScan(baseQr(), 10, new Date("2026-01-01T12:00:00Z"));

    assert.equal(decision.httpStatus, 200);
    assert.equal(decision.success, true);
    assert.equal(decision.scanStatus, "authorized");
    assert.equal(decision.shouldRecord, true);
    assert.equal(decision.shouldMarkUsedUp, true);
    assert.equal(decision.remaining, 0);
});

test("evaluateQrScan rejects QR from another organization without recording", () => {
    const decision = evaluateQrScan(baseQr(), 99);

    assert.equal(decision.httpStatus, 403);
    assert.equal(decision.success, false);
    assert.equal(decision.shouldRecord, false);
});

test("evaluateQrScan rejects revoked QR and records denied status", () => {
    const decision = evaluateQrScan(baseQr({ status: "revoked" }), 10);

    assert.equal(decision.httpStatus, 200);
    assert.equal(decision.success, false);
    assert.equal(decision.scanStatus, "denied_revoked");
    assert.equal(decision.shouldRecord, true);
});

test("evaluateQrScan rejects QR that reached usage limit", () => {
    const decision = evaluateQrScan(baseQr({ usage_limit: 2, scans_count: 2 }), 10);

    assert.equal(decision.success, false);
    assert.equal(decision.scanStatus, "denied_limit_reached");
});

test("evaluateQrScan rejects QR outside validity window", () => {
    const beforeWindow = evaluateQrScan(
        baseQr({ valid_from: new Date("2026-01-02T00:00:00Z") }),
        10,
        new Date("2026-01-01T12:00:00Z")
    );
    const afterWindow = evaluateQrScan(
        baseQr({ valid_until: new Date("2026-01-01T00:00:00Z") }),
        10,
        new Date("2026-01-02T12:00:00Z")
    );

    assert.equal(beforeWindow.scanStatus, "denied_expired");
    assert.equal(afterWindow.scanStatus, "denied_expired");
});

test("evaluateQrScan supports unlimited QR codes", () => {
    const decision = evaluateQrScan(baseQr({ usage_limit: 0, scans_count: 50 }), 10);

    assert.equal(decision.success, true);
    assert.equal(decision.shouldMarkUsedUp, false);
    assert.equal(decision.remaining, "Illimité");
});
