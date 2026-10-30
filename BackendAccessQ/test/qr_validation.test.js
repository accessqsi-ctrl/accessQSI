const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeHolderName, validateQrPayload } = require("../src/services/qr_validation.service");

test("QR holder names retain every word after spaces", () => {
    const validation = validateQrPayload({
        fullName: "Jean Baptiste Mukendi",
        accessType: "single"
    });

    assert.deepEqual(validation.errors, []);
    assert.equal(validation.values.fullName, "Jean Baptiste Mukendi");
});

test("QR holder names normalize pasted whitespace without dropping words", () => {
    assert.equal(
        normalizeHolderName("  Marie\u00a0  Claire\nKabongo  "),
        "Marie Claire Kabongo"
    );
});

test("QR validation accepts the database-style holder_name alias", () => {
    const validation = validateQrPayload({
        holder_name: "Grâce Mwamba Tshibangu",
        accessType: "single"
    });

    assert.deepEqual(validation.errors, []);
    assert.equal(validation.values.fullName, "Grâce Mwamba Tshibangu");
});

test("CSV dates without a timezone are read in the administrator's timezone", () => {
    const { errors, values } = validateQrPayload({
        fullName: "Grace Mbuyi",
        validFrom: "2026-11-02 08:00",
        validUntil: "30/11/2026 18:30",
        periodTimezone: "Africa/Kinshasa"
    });

    assert.deepEqual(errors, []);
    assert.equal(values.validFrom.toISOString(), "2026-11-02T07:00:00.000Z");
    assert.equal(values.validUntil.toISOString(), "2026-11-30T17:30:00.000Z");
});

test("CSV date-only bounds cover the whole local day", () => {
    const { values } = validateQrPayload({
        fullName: "Grace Mbuyi",
        validFrom: "01/11/2026",
        validUntil: "2026-11-30",
        periodTimezone: "Europe/Paris"
    });

    assert.equal(values.validFrom.toISOString(), "2026-10-31T23:00:00.000Z");
    assert.equal(values.validUntil.toISOString(), "2026-11-30T22:59:59.999Z");
});

test("dates with an explicit timezone are kept as sent", () => {
    const { values } = validateQrPayload({
        fullName: "Grace Mbuyi",
        validFrom: "2026-11-02T07:00:00.000Z",
        periodTimezone: "Asia/Tokyo"
    });

    assert.equal(values.validFrom.toISOString(), "2026-11-02T07:00:00.000Z");
});

test("impossible CSV dates are rejected instead of rolling over", () => {
    const { errors } = validateQrPayload({ fullName: "Grace Mbuyi", validFrom: "31/02/2026 08:00" });

    assert.deepEqual(errors.map(error => error.field), ["validFrom"]);
});
