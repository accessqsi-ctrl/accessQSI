import test from "node:test";
import assert from "node:assert/strict";

import {
    addObject,
    canDeleteObject,
    createObject,
    deleteObject,
    duplicateObject,
    MAX_SCENE_OBJECTS,
    moveObjectTo,
    reorderObject,
    resizeCanvas,
    resizeObjectTo,
    resolveTextValue,
    sampleValues,
    scaleSceneToCanvas,
    addBackSide,
    removeBackSide,
    replaceSceneColor,
    sideView,
    withSide
} from "../src/app/lib/cardScene.mjs";

const baseScene = () => ({
    version: 3,
    canvas: { width: 1200, height: 600, backgroundColor: "#ffffff" },
    objects: [
        { id: "bg", type: "rect", x: 0, y: 0, width: 1200, height: 600, fill: "#2563eb", stroke: "#dbeafe", zIndex: 1 },
        { id: "holder", type: "text", field: "holder", text: "{{holder}}", x: 40, y: 40, width: 400, height: 60, zIndex: 2 },
        { id: "qr", type: "qr", x: 800, y: 100, width: 280, height: 280, zIndex: 3 }
    ]
});

test("text values replace variables like the server renderer", () => {
    const values = sampleValues({ title: "PASS VIP" });
    assert.equal(resolveTextValue({ text: "Bienvenue {{ holder }} — {{title}}" }, values), "Bienvenue Marie Kabongo — PASS VIP");
    assert.equal(resolveTextValue({ field: "event", text: "" }, values), "Nom de l’événement");
});

test("new objects get a unique id, centered position and the highest zIndex", () => {
    const scene = baseScene();
    const object = createObject(scene, "text");
    assert.equal(object.id, "text-4");
    assert.equal(object.zIndex, 4);
    assert.equal(object.x, Math.round((1200 - object.width) / 2) + 3 * 24);
    assert.ok(createObject({ ...scene, canvas: { width: 300, height: 300 } }, "text").width <= 260);
    assert.equal(addObject(scene, object).objects.length, 4);
});

test("scenes are capped at the server limit of objects", () => {
    let scene = baseScene();
    while (scene.objects.length < MAX_SCENE_OBJECTS) scene = addObject(scene, createObject(scene, "rect"));
    assert.equal(addObject(scene, createObject(scene, "rect")).objects.length, MAX_SCENE_OBJECTS);
    assert.equal(duplicateObject(scene, "bg").id, null);
});

test("the last QR code of a card cannot be deleted", () => {
    const scene = baseScene();
    assert.equal(canDeleteObject(scene, "qr"), false);
    assert.equal(deleteObject(scene, "qr").objects.length, 3);
    const { scene: withTwo } = duplicateObject(scene, "qr");
    assert.equal(canDeleteObject(withTwo, "qr"), true);
    assert.equal(deleteObject(scene, "holder").objects.length, 2);
});

test("reordering renumbers layers", () => {
    const front = reorderObject(baseScene(), "bg", "front");
    assert.equal(front.objects.find(object => object.id === "bg").zIndex, 3);
    assert.equal(front.objects.find(object => object.id === "qr").zIndex, 2);
    const back = reorderObject(front, "bg", "back");
    assert.equal(back.objects.find(object => object.id === "bg").zIndex, 1);
});

test("moves snap to the grid and stay partly on the card", () => {
    const scene = baseScene();
    const text = scene.objects[1];
    assert.deepEqual(moveObjectTo(text, 123, 47, scene, 10), { x: 120, y: 50 });
    assert.deepEqual(moveObjectTo(text, 5000, -5000, scene, 0), { x: 1190, y: -50 });
});

test("QR codes stay square and readable when resized", () => {
    assert.deepEqual(resizeObjectTo({ type: "qr" }, 300, 200, 0), { width: 300, height: 300 });
    assert.deepEqual(resizeObjectTo({ type: "qr" }, 40, 40, 0), { width: 120, height: 120 });
    assert.deepEqual(resizeObjectTo({ type: "text" }, 3, 3, 0), { width: 10, height: 10 });
});

test("canvas size is bounded like on the server", () => {
    assert.deepEqual(resizeCanvas(baseScene(), 100, 9000).canvas, { width: 240, height: 2600, backgroundColor: "#ffffff" });
});

test("switching to a preset format scales and centers the whole composition", () => {
    const scaled = scaleSceneToCanvas(baseScene(), 600, 600);
    assert.deepEqual(scaled.canvas, { width: 600, height: 600, backgroundColor: "#ffffff" });
    const background = scaled.objects.find(object => object.id === "bg");
    assert.deepEqual([background.x, background.y, background.width, background.height], [0, 150, 600, 300]);
    const qr = scaled.objects.find(object => object.id === "qr");
    assert.equal(qr.width, qr.height);
    assert.ok(qr.x + qr.width <= 600 && qr.y + qr.height <= 600);
});

test("a back side can be added, edited through its view and removed", () => {
    const scene = addBackSide(baseScene());
    assert.equal(scene.back.objects.length, 1);
    assert.equal(sideView(scene, "front").objects.length, 3);

    const view = sideView(scene, "back");
    assert.equal(view.canvas.width, 1200);
    const edited = withSide(scene, "back", {
        canvas: { ...view.canvas, backgroundColor: "#0f172a" },
        objects: [...view.objects, createObject(view, "rect")]
    });
    assert.equal(edited.back.objects.length, 2);
    assert.equal(edited.back.backgroundColor, "#0f172a");
    assert.equal(edited.canvas.backgroundColor, "#ffffff");
    assert.equal(edited.objects.length, 3);
    assert.equal(removeBackSide(edited).back, null);
});

test("the back side needs no QR code and is scaled with the front", () => {
    const scene = addBackSide(baseScene());
    const back = { canvas: scene.canvas, objects: [{ id: "qr-back", type: "qr", x: 0, y: 0, width: 200, height: 200 }] };
    assert.equal(canDeleteObject(back, "qr-back"), false);
    assert.equal(canDeleteObject(back, "qr-back", { requireQr: false }), true);

    const scaled = scaleSceneToCanvas(scene, 600, 300);
    assert.ok(scaled.back.objects[0].fontSize < scene.back.objects[0].fontSize);
});

test("replaceSceneColor recolore recto et verso sans toucher aux autres teintes", () => {
    const scene = {
        canvas: { width: 1600, height: 600, backgroundColor: "#ffffff" },
        objects: [
            { id: "a", type: "rect", fill: "#2563EB", stroke: "#dbeafe" },
            { id: "b", type: "text", fill: "#0f172a" }
        ],
        back: { backgroundColor: "#2563eb", objects: [{ id: "c", type: "line", stroke: "#2563eb" }] }
    };
    const next = replaceSceneColor(scene, "#2563eb", "#0b1f4b");
    assert.equal(next.objects[0].fill, "#0b1f4b");
    assert.equal(next.objects[0].stroke, "#dbeafe");
    assert.equal(next.objects[1].fill, "#0f172a");
    assert.equal(next.back.backgroundColor, "#0b1f4b");
    assert.equal(next.back.objects[0].stroke, "#0b1f4b");
    assert.equal(next.canvas.backgroundColor, "#ffffff");
});

test("replaceSceneColor ignore une saisie incomplète", () => {
    const scene = { canvas: { width: 10, height: 10 }, objects: [{ id: "a", fill: "#2563eb" }], back: null };
    assert.equal(replaceSceneColor(scene, "#2563eb", "#25"), scene);
});
