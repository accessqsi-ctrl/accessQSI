const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const service = require("../src/services/pdf_template.service");

test("resolveNormalizedField converts ratios to real PDF coordinates", () => {
    const page = { getSize: () => ({ width: 500, height: 300 }) };
    const resolved = service.resolveNormalizedField(page, {
        x: 0.2,
        y: 0.55,
        width: 0.6,
        height: 0.25,
        fontSizeRatio: 0.04
    });

    assert.deepEqual(resolved, {
        x: 100,
        y: 165,
        width: 300,
        height: 75,
        fontSize: 12
    });
});

test("drawTextInZone shrinks and centers text inside the target zone", () => {
    const drawn = [];
    const page = {
        getSize: () => ({ width: 400, height: 200 }),
        drawText: (text, options) => drawn.push({ text, options })
    };
    const font = {
        widthOfTextAtSize: (text, size) => text.length * size
    };

    const result = service.drawTextInZone({
        page,
        text: "Texte beaucoup trop long",
        font,
        field: {
            x: 0.25,
            y: 0.5,
            width: 0.5,
            fontSizeRatio: 0.2,
            minFontSize: 8,
            align: "center"
        }
    });

    assert.equal(drawn.length, 1);
    assert.ok(result.fontSize < 40);
    assert.ok(result.fontSize >= 8);
    assert.ok(drawn[0].options.x >= 100);
});

test("generateDocument creates a PDF from a registered template id", async () => {
    const result = await service.generateDocument({
        templateId: "badge-horizontal",
        values: {
            fullName: "Élodie Kabeya",
            company: "AccessQ",
            identifier: "VIP-2026"
        }
    });

    const outputPath = service.generatedPathForFilename(result.filename);
    assert.equal(fs.existsSync(outputPath), true);
    assert.ok(fs.statSync(outputPath).size > 500);

    fs.unlinkSync(outputPath);
});

test("generateDocument rejects unknown template ids", async () => {
    await assert.rejects(
        () => service.generateDocument({ templateId: "../secret", values: {} }),
        /Modèle PDF invalide/
    );
});
