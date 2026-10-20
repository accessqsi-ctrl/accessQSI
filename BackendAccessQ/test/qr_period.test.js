const test = require("node:test");
const assert = require("node:assert/strict");
const { getPeriodBounds, describePeriodLimit, resolveTimeZone } = require("../src/services/qr_period.service");
const { validateQrPayload } = require("../src/services/qr_validation.service");

const bounds = (unit, now, timeZone) => {
    const result = getPeriodBounds(unit, new Date(now), timeZone);
    return [result.start.toISOString(), result.next.toISOString()];
};

test("daily periods start at local midnight in the QR time zone", () => {
    // 23h30 UTC est déjà le lendemain à Kinshasa (UTC+1).
    assert.deepEqual(bounds("day", "2026-10-20T23:30:00Z", "Africa/Kinshasa"), [
        "2026-10-20T23:00:00.000Z",
        "2026-10-21T23:00:00.000Z"
    ]);
    assert.deepEqual(bounds("day", "2026-10-20T22:30:00Z", "Africa/Kinshasa"), [
        "2026-10-19T23:00:00.000Z",
        "2026-10-20T23:00:00.000Z"
    ]);
});

test("weekly periods start on Monday and monthly periods roll over the year", () => {
    assert.deepEqual(bounds("week", "2026-10-20T10:00:00Z", "Africa/Kinshasa"), [
        "2026-10-18T23:00:00.000Z",
        "2026-10-25T23:00:00.000Z"
    ]);
    assert.deepEqual(bounds("month", "2026-12-31T23:30:00Z", "Africa/Nairobi"), [
        "2026-12-31T21:00:00.000Z",
        "2027-01-31T21:00:00.000Z"
    ]);
});

test("periods follow daylight saving changes", () => {
    assert.deepEqual(bounds("day", "2026-03-29T12:00:00Z", "Europe/Paris"), [
        "2026-03-28T23:00:00.000Z",
        "2026-03-29T22:00:00.000Z"
    ]);
});

test("invalid time zones fall back to DEFAULT_TIMEZONE then UTC", () => {
    const previous = process.env.DEFAULT_TIMEZONE;
    try {
        delete process.env.DEFAULT_TIMEZONE;
        assert.equal(resolveTimeZone("Invalid/Zone"), "UTC");
        process.env.DEFAULT_TIMEZONE = "Africa/Lagos";
        assert.equal(resolveTimeZone(""), "Africa/Lagos");
        assert.equal(resolveTimeZone("Africa/Kinshasa"), "Africa/Kinshasa");
    } finally {
        if (previous === undefined) delete process.env.DEFAULT_TIMEZONE;
        else process.env.DEFAULT_TIMEZONE = previous;
    }
});

test("period limits are described for the dashboard", () => {
    assert.equal(describePeriodLimit(1, "day"), "1 par jour");
    assert.equal(describePeriodLimit(20, "month"), "20 par mois");
    assert.equal(describePeriodLimit(null, null), null);
});

test("QR payload validation accepts an optional period limit", () => {
    const none = validateQrPayload({ fullName: "Awa Diallo", accessType: "unlimited" });
    assert.deepEqual(none.errors, []);
    assert.equal(none.values.periodUnit, null);
    assert.equal(none.values.periodLimit, null);
    assert.equal(none.values.periodTimezone, null);

    const daily = validateQrPayload({
        fullName: "Awa Diallo",
        accessType: "unlimited",
        periodUnit: "DAY",
        periodTimezone: "Africa/Dakar"
    });
    assert.deepEqual(daily.errors, []);
    assert.equal(daily.values.periodUnit, "day");
    assert.equal(daily.values.periodLimit, 1);
    assert.equal(daily.values.periodTimezone, "Africa/Dakar");
});

test("QR payload validation rejects invalid period settings", () => {
    const validation = validateQrPayload({
        fullName: "Awa Diallo",
        periodUnit: "year",
        periodLimit: "0"
    });
    assert.deepEqual(validation.errors.map(error => error.field), ["periodUnit", "periodLimit"]);
});
