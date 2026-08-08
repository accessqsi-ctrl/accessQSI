const test = require("node:test");
const assert = require("node:assert/strict");
const { PDFDocument } = require("pdf-lib");

const cardTemplateService = require("../src/services/card_template.service");

const imageCustomization = {
    primaryColor: "#2563eb",
    secondaryColor: "#dbeafe",
    backgroundImageUrl: "/card-backgrounds/wedding-modern-navy-beige.png"
};

test("primary image uses centered cover rendering in supported templates", () => {
    const cases = [
        ["event-ticket", "horizontal-primary-zone"],
        ["staff-card", "vertical-primary-zone"],
        ["compact-ticket", "compact-primary-zone"]
    ];

    for (const [templateId, clipId] of cases) {
        const svg = cardTemplateService.renderPreview({
            templateId,
            customization: imageCustomization
        });

        assert.match(svg, new RegExp(`clipPath id="${clipId}"`));
        assert.match(svg, /data:image\/png;base64,/);
        assert.match(svg, /preserveAspectRatio="xMidYMid slice"/);
        assert.match(svg, new RegExp(`clip-path="url\\(#${clipId}\\)"`));
    }
});

test("wedding invitation ignores the primary image option", () => {
    const svg = cardTemplateService.renderPreview({
        templateId: "wedding-invite",
        customization: imageCustomization
    });

    assert.doesNotMatch(svg, /data:image\/png;base64,/);
    assert.doesNotMatch(svg, /primary-zone/);
    assert.match(svg, /<rect x="70" y="70" width="1060" height="1660" rx="58" fill="#ffffff"/);
});

test("supported templates keep their color when no image is provided", () => {
    const svg = cardTemplateService.renderPreview({
        templateId: "event-ticket",
        customization: {
            primaryColor: "#123456",
            secondaryColor: "#dbeafe",
            backgroundImageUrl: ""
        }
    });

    assert.match(svg, /<rect x="40" y="40" width="420" height="520" rx="28" fill="#123456"/);
    assert.doesNotMatch(svg, /horizontal-primary-zone/);
});

test("generateCardsPdfBuffer creates one PDF page per QR without writing files", async () => {
    const event = {
        title: "Concert",
        EventSchedules: [{
            start_date: "2026-08-08T18:00:00.000Z",
            area: { area_name: "Salle principale" }
        }]
    };
    const qrUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const cards = [1, 2].map(id => ({
        templateId: "event-ticket",
        event,
        qrRecord: { qr_id: id, holder_name: `Invité ${id}`, level: 1 },
        qrUrl,
        cardMessage: "Bienvenue"
    }));

    const bytes = await cardTemplateService.generateCardsPdfBuffer(cards);
    const pdf = await PDFDocument.load(bytes);

    assert.equal(pdf.getPageCount(), 2);
});
