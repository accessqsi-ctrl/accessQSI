const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateQrScan } = require("../src/services/qr_policy.service");

const baseQr = (overrides = {}) => ({
    qr_id: 1,
    event_id: 5,
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

test("evaluateQrScan rejects a QR from another selected event", () => {
    const decision = evaluateQrScan(baseQr(), 10, new Date("2026-01-01T12:00:00Z"), 4, 6);

    assert.equal(decision.success, false);
    assert.equal(decision.scanStatus, "denied_event_not_selected");
    assert.equal(decision.reason, "Ce QR Code n'appartient pas à l'événement sélectionné.");
    assert.equal(decision.areaId, 4);
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

test("evaluateQrScan rejects persisted used_up and expired statuses", () => {
    const usedUp = evaluateQrScan(baseQr({ status: "used_up", usage_limit: 10 }), 10);
    const expired = evaluateQrScan(baseQr({ status: "expired", valid_until: null }), 10);

    assert.equal(usedUp.scanStatus, "denied_limit_reached");
    assert.equal(expired.scanStatus, "denied_expired");
});

test("evaluateQrScan requires a scheduled event area", () => {
    const qr = baseQr({
        level: 2,
        event: {
            org_id: 10,
            EventSchedules: [{
                id_area: 4,
                start_date: new Date("2026-01-01T10:00:00Z"),
                end_date: new Date("2026-01-01T18:00:00Z"),
                area: { accreditation_level: 2 }
            }]
        }
    });

    const decision = evaluateQrScan(qr, 10, new Date("2026-01-01T12:00:00Z"));

    assert.equal(decision.success, false);
    assert.equal(decision.scanStatus, "denied_area_not_allowed");
});

test("evaluateQrScan applies the selected area schedule and accreditation level", () => {
    const qr = baseQr({
        level: 1,
        event: {
            org_id: 10,
            EventSchedules: [{
                id_area: 4,
                start_date: new Date("2026-01-01T10:00:00Z"),
                end_date: new Date("2026-01-01T18:00:00Z"),
                area: { accreditation_level: 2 }
            }]
        }
    });

    const insufficient = evaluateQrScan(qr, 10, new Date("2026-01-01T12:00:00Z"), 4);
    const inactive = evaluateQrScan(
        { ...qr, level: 2 },
        10,
        new Date("2026-01-01T20:00:00Z"),
        4
    );
    const authorized = evaluateQrScan(
        { ...qr, level: 2 },
        10,
        new Date("2026-01-01T12:00:00Z"),
        4
    );

    assert.equal(insufficient.scanStatus, "denied_insufficient_level");
    assert.equal(insufficient.areaId, 4);
    assert.equal(inactive.scanStatus, "denied_event_inactive");
    assert.equal(authorized.success, true);
    assert.equal(authorized.areaId, 4);
});
