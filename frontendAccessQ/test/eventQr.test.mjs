import test from "node:test";
import assert from "node:assert/strict";

import {
    formatInternationalPhone,
    normalizePhone,
    selectTemplateForExistingQr,
    validateQrContact
} from "../src/app/lib/eventQr.mjs";

test("normalizePhone removes presentation characters", () => {
    assert.equal(normalizePhone("+243 (812) 345-678"), "+243812345678");
});

test("formatInternationalPhone normalizes the international prefix and caps E.164 length", () => {
    assert.equal(formatInternationalPhone("00243 812 345 678"), "+243 812 345 678");
    assert.equal(formatInternationalPhone("2438123456789999"), "+243 812 345 678 999");
});

test("validateQrContact accepts empty optional contacts and valid international values", () => {
    assert.deepEqual(validateQrContact({ email: "", phone: "" }), {});
    assert.deepEqual(validateQrContact({ email: "USER@example.com", phone: "+243 812 345 678" }), {});
});

test("validateQrContact reports malformed email and phone values", () => {
    const errors = validateQrContact({ email: "invalid", phone: "0812" });
    assert.match(errors.email, /email valide/);
    assert.match(errors.phone, /format international/);
});

test("selectTemplateForExistingQr preserves the current published template", () => {
    const templates = [{ templateId: "custom:1" }, { templateId: "custom:2" }];
    assert.equal(selectTemplateForExistingQr({ cardTemplateId: "custom:2" }, templates, "custom:1"), "custom:2");
});

test("selectTemplateForExistingQr falls back to the default then the first template", () => {
    const templates = [{ templateId: "custom:1" }, { templateId: "custom:2" }];
    assert.equal(selectTemplateForExistingQr({ cardTemplateId: "custom:9" }, templates, "custom:2"), "custom:2");
    assert.equal(selectTemplateForExistingQr({}, templates, ""), "custom:1");
    assert.equal(selectTemplateForExistingQr({}, [], "custom:2"), "");
});

test("describePeriodLimit summarizes per-period limits and ignores incomplete settings", async () => {
    const { describePeriodLimit, PERIOD_UNIT_OPTIONS } = await import("../src/app/lib/eventQr.mjs");
    assert.equal(describePeriodLimit("1", "day"), "1 par jour");
    assert.equal(describePeriodLimit(3, "week"), "3 par semaine");
    assert.equal(describePeriodLimit(20, "month"), "20 par mois");
    assert.equal(describePeriodLimit(0, "day"), "");
    assert.equal(describePeriodLimit(2, ""), "");
    assert.deepEqual(PERIOD_UNIT_OPTIONS.map(option => option.value), ["", "day", "week", "month"]);
});
