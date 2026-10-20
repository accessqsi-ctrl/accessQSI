const test = require("node:test");
const assert = require("node:assert/strict");
const { clearSrcModules, mockModule } = require("./helpers/http");
const { layoutText, measureWithFont } = require("../src/services/card_text_layout.service");
const { normalizeFontId, isBoldWeight } = require("../src/config/cardFonts");

// Mesure fictive : chaque caractère vaut 0,5 × la taille de police.
const fakeMeasure = (text, size) => String(text).length * size * 0.5;

test("short text keeps its size on a single line", () => {
    const layout = layoutText({ text: "Marie", width: 400, height: 50, fontSize: 30, measure: fakeMeasure });
    assert.deepEqual(layout.lines, ["Marie"]);
    assert.equal(layout.fontSize, 30);
});

test("long text wraps on words before shrinking", () => {
    const layout = layoutText({ text: "Jean Baptiste Mukendi", width: 200, height: 80, fontSize: 30, measure: fakeMeasure });
    assert.equal(layout.fontSize, 30);
    assert.deepEqual(layout.lines, ["Jean Baptiste", "Mukendi"]);
    assert.ok(layout.lines.every(line => fakeMeasure(line, layout.fontSize) <= 200));
});

test("text shrinks until every line fits the frame", () => {
    const layout = layoutText({ text: "Jean Baptiste Mukendi Kabongo", width: 200, height: 40, fontSize: 30, measure: fakeMeasure });
    assert.ok(layout.fontSize < 30);
    assert.ok(layout.lines.length * layout.lineHeight <= 40.5);
    assert.ok(layout.lines.every(line => fakeMeasure(line, layout.fontSize) <= 200.5));
});

test("text that cannot fit even at the minimum size is truncated with an ellipsis", () => {
    const text = "Conférence internationale sur la transformation numérique des services publics en Afrique centrale";
    const layout = layoutText({ text, width: 120, height: 20, fontSize: 30, measure: fakeMeasure });
    assert.equal(layout.fontSize, 15);
    assert.equal(layout.lines.length, 1);
    assert.match(layout.lines[0], /…$/);
    assert.ok(fakeMeasure(layout.lines[0], layout.fontSize) <= 120);
});

test("real font metrics differ between families", () => {
    const sans = measureWithFont("sans", "700")("Mariage de Grâce", 40);
    const elegant = measureWithFont("elegant", "400")("Mariage de Grâce", 40);
    assert.ok(sans > 0 && elegant > 0);
    assert.notEqual(Math.round(sans), Math.round(elegant));
});

test("font identifiers and weights are normalized", () => {
    assert.equal(normalizeFontId("serif"), "serif");
    assert.equal(normalizeFontId("Arial"), "sans");
    assert.equal(normalizeFontId("Times New Roman"), "serif");
    assert.equal(normalizeFontId("Comic Sans"), "sans");
    assert.equal(isBoldWeight("700"), true);
    assert.equal(isBoldWeight("bold"), true);
    assert.equal(isBoldWeight("400"), false);
});

const loadCustomTemplateService = () => {
    clearSrcModules();
    let created = null;
    mockModule("src/prisma/client", {
        cardTemplateCustom: {
            create: async ({ data }) => {
                created = data;
                return { id: 3, status: "DRAFT", is_default: false, created_at: new Date(), updated_at: new Date(), ...data };
            }
        }
    });
    return { service: require("../src/services/custom_card_template.service"), getCreated: () => created };
};

test("canvas scenes keep only known fonts and platform-hosted images", async () => {
    const { service, getCreated } = loadCustomTemplateService();
    await service.createForOrg(42, {
        name: "Carte élève",
        baseTemplateId: "event-ticket",
        canvasScene: {
            canvas: { width: 1200, height: 700 },
            objects: [
                { id: "t", type: "text", text: "{{holder}}", fontFamily: "elegant", fontWeight: "bold" },
                { id: "u", type: "text", text: "x", fontFamily: "Papyrus", fontWeight: "heavy; fill:red" },
                { id: "own", type: "image", src: "/card-backgrounds/background_42_0b9b6c5e-7d1f-4a5e-9c33-1f2e3d4c5b6a.png" },
                { id: "ext", type: "image", src: "https://tracker.example.com/pixel.png" },
                { id: "file", type: "image", src: "/etc/passwd" }
            ]
        }
    });
    const objects = getCreated().canvas_scene.objects;
    assert.equal(objects[0].fontFamily, "elegant");
    assert.equal(objects[0].fontWeight, "bold");
    assert.equal(objects[1].fontFamily, "sans");
    assert.equal(objects[1].fontWeight, "700");
    assert.equal(objects[2].src, "/card-backgrounds/background_42_0b9b6c5e-7d1f-4a5e-9c33-1f2e3d4c5b6a.png");
    assert.equal(objects[3].src, null);
    assert.equal(objects[4].src, null);
});

test("previewing a canvas scene wraps long names and uses the selected font", async () => {
    const { service } = loadCustomTemplateService();
    const svg = await service.previewPayload({
        name: "Aperçu",
        baseTemplateId: "event-ticket",
        canvasScene: {
            canvas: { width: 1200, height: 700 },
            objects: [{ id: "h", type: "text", text: "Jean-Baptiste Mukendi Kabongo Tshibangu", x: 40, y: 40, width: 300, height: 120, fontSize: 40, fontFamily: "serif" }]
        }
    });
    assert.match(svg, /font-family="aq-serif"/);
    assert.ok((svg.match(/<tspan /g) || []).length >= 2);
});

// L'éditeur (frontend) embarque une copie de l'algorithme : elle doit rester identique.
const frontendLayoutPath = require("path").resolve(__dirname, "../../frontendAccessQ/src/app/lib/cardTextLayout.mjs");
test("frontend text layout stays identical to the server implementation", { skip: !require("fs").existsSync(frontendLayoutPath) }, () => {
    const fs = require("fs");
    const algorithm = source => source
        .slice(source.indexOf("const wrapLines"), source.indexOf("// Mesure"))
        .replace(/^export /gm, "")
        .trim();
    const server = algorithm(fs.readFileSync(require.resolve("../src/services/card_text_layout.service"), "utf8"));
    const frontend = algorithm(fs.readFileSync(frontendLayoutPath, "utf8"));
    assert.ok(server.includes("const layoutText"));
    assert.equal(frontend, server);
});

test("the optional back side is normalized like the front", async () => {
    const { service, getCreated } = loadCustomTemplateService();
    await service.createForOrg(42, {
        name: "Carte élève recto-verso",
        baseTemplateId: "event-ticket",
        canvasScene: {
            canvas: { width: 1012, height: 638 },
            objects: [{ id: "qr", type: "qr" }],
            back: {
                backgroundColor: "javascript:alert(1)",
                objects: [
                    { id: "rules", type: "text", text: "Règlement", fontFamily: "serif", x: 99999 },
                    { id: "evil", type: "script" }
                ]
            }
        }
    });
    const back = getCreated().canvas_scene.back;
    assert.equal(back.backgroundColor, "#ffffff");
    assert.equal(back.objects.length, 1);
    assert.equal(back.objects[0].fontFamily, "serif");
    assert.equal(back.objects[0].x, 2400);

    await service.createForOrg(42, { name: "Recto seul", baseTemplateId: "event-ticket", canvasScene: { objects: [] } });
    assert.equal(getCreated().canvas_scene.back, null);
});
