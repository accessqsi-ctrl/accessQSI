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

const sampleEvent = {
    title: "Rentrée 2026",
    EventSchedules: [{ start_date: "2026-09-01T07:00:00.000Z", area: { area_name: "Cantine" } }]
};
const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const freeLayout = (back) => ({
    baseTemplateId: "event-ticket",
    customization: {
        canvasScene: {
            version: 3,
            canvas: { width: 1012, height: 638, backgroundColor: "#ffffff" },
            objects: [
                { id: "holder", type: "text", text: "{{holder}}", x: 40, y: 40, width: 500, height: 60, fontSize: 40, fontFamily: "sans", fontWeight: "700", fill: "#0f172a", visible: true, zIndex: 1 },
                { id: "qr", type: "qr", x: 700, y: 200, width: 260, height: 260, visible: true, zIndex: 2 }
            ],
            back
        }
    }
});

test("a free layout with a back side renders front then back for each QR", async () => {
    const back = {
        backgroundColor: "#f8fafc",
        objects: [{ id: "rules", type: "text", text: "Carte strictement personnelle", x: 40, y: 40, width: 900, height: 80, fontSize: 36, fontFamily: "serif", fontWeight: "400", fill: "#0f172a", visible: true, zIndex: 1 }]
    };
    const cards = [1, 2].map(id => ({
        templateId: "event-ticket",
        customization: freeLayout(back),
        event: sampleEvent,
        qrRecord: { qr_id: id, holder_name: `Élève ${id}`, level: 1 },
        qrUrl: pixel,
        cardMessage: ""
    }));

    const pdf = await PDFDocument.load(await cardTemplateService.generateCardsPdfBuffer(cards));
    assert.equal(pdf.getPageCount(), 4);
    const [width, height] = [pdf.getPage(1).getWidth(), pdf.getPage(1).getHeight()];
    assert.deepEqual([Math.round(width), Math.round(height)], [1012, 638]);
});

test("a free layout without back objects keeps a single page per QR", async () => {
    const pdf = await PDFDocument.load(await cardTemplateService.generateCardsPdfBuffer([{
        templateId: "event-ticket",
        customization: freeLayout({ backgroundColor: "#ffffff", objects: [] }),
        event: sampleEvent,
        qrRecord: { qr_id: 3, holder_name: "Élève 3", level: 1 },
        qrUrl: pixel,
        cardMessage: ""
    }]));
    assert.equal(pdf.getPageCount(), 1);
});

test("the AccessQ mention stays on standard templates and is opt-in on custom ones", () => {
    const payload = { event: sampleEvent, qrRecord: { qr_id: 4, holder_name: "Awa", level: 1 }, qrUrl: pixel, cardMessage: "" };
    const render = (customization) => cardTemplateService.renderPreview({ templateId: "event-ticket", customization, ...payload });

    assert.match(render(null), />AccessQ</);
    assert.doesNotMatch(render({ primaryColor: "#7c3aed", secondaryColor: "#ede9fe", visibleFields: { holder: true } }), />AccessQ</);
    assert.match(render({ primaryColor: "#7c3aed", secondaryColor: "#ede9fe", visibleFields: { brand: true } }), />AccessQ</);
});
