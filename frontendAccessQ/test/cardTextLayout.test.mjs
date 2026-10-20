import test from "node:test";
import assert from "node:assert/strict";

import { layoutText } from "../src/app/lib/cardTextLayout.mjs";
import { normalizeFontId, isBoldWeight } from "../src/app/lib/cardFonts.mjs";

// Mêmes cas que BackendAccessQ/test/card_text_layout.test.js : les deux implémentations
// doivent produire la même mise en page.
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
});

test("font identifiers and weights are normalized like on the server", () => {
    assert.equal(normalizeFontId("elegant"), "elegant");
    assert.equal(normalizeFontId("Arial"), "sans");
    assert.equal(normalizeFontId("Times New Roman"), "serif");
    assert.equal(normalizeFontId("Papyrus"), "sans");
    assert.equal(isBoldWeight("bold"), true);
    assert.equal(isBoldWeight("400"), false);
});
