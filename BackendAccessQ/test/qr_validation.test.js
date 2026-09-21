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
