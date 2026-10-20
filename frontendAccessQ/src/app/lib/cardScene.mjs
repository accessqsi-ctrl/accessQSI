// Opérations pures sur une scène de carte (format version 3, rendue à l'identique par
// BackendAccessQ/src/services/card_template.service.js#renderCanvasScene).
export const MAX_SCENE_OBJECTS = 80;

export const SCENE_FORMATS = [
    { id: "ticket", label: "Billet horizontal", width: 1600, height: 600 },
    { id: "compact", label: "Ticket compact", width: 1200, height: 520 },
    { id: "id-card", label: "Carte format bancaire (85 × 54 mm)", width: 1012, height: 638 },
    { id: "badge", label: "Badge vertical", width: 900, height: 1400 },
    { id: "a6", label: "A6 portrait", width: 1240, height: 1748 },
    { id: "invitation", label: "Invitation verticale", width: 1200, height: 1800 }
];

export const FIELD_OPTIONS = [
    { id: "holder", label: "Nom du titulaire" },
    { id: "event", label: "Nom de l’événement" },
    { id: "date", label: "Date" },
    { id: "location", label: "Lieu / zones" },
    { id: "level", label: "Niveau d’accès" },
    { id: "message", label: "Message" },
    { id: "title", label: "Titre du modèle" },
    { id: "cardId", label: "Numéro de carte" }
];

const FIELD_PATTERN = /\{\{\s*(title|event|holder|date|location|level|message|cardId)\s*\}\}/g;

export const sampleValues = (template = {}) => ({
    title: template.title || "INVITATION",
    event: "Nom de l’événement",
    holder: "Marie Kabongo",
    date: "12 juillet 2026",
    location: "Salle principale",
    level: "Niveau 1",
    message: String(template.cardMessageDefault || "Présentez ce QR à l’entrée").trim(),
    cardId: "QR-1"
});

// Même règle que getCanvasValue côté serveur.
export const resolveTextValue = (object, values) => {
    const field = object.field && values[object.field] ? values[object.field] : "";
    const rawText = String(object.text || field || object.label || "");
    return rawText.replace(FIELD_PATTERN, (_, key) => values[key] || "");
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const snapValue = (value, grid) => (grid > 1 ? Math.round(value / grid) * grid : Math.round(value));

const nextZIndex = (scene) => scene.objects.reduce((max, object) => Math.max(max, object.zIndex || 0), 0) + 1;

const uniqueId = (scene, type) => {
    const used = new Set(scene.objects.map(object => object.id));
    let index = scene.objects.length + 1;
    while (used.has(`${type}-${index}`)) index += 1;
    return `${type}-${index}`;
};

const OBJECT_DEFAULTS = {
    text: { width: 520, height: 70, text: "Nouveau texte", fontSize: 40, fontWeight: "700", fontFamily: "sans", fill: "#0f172a", align: "left" },
    rect: { width: 360, height: 200, fill: "#dbeafe", stroke: "#2563eb", strokeWidth: 0, cornerRadius: 16 },
    line: { width: 400, height: 0, stroke: "#2563eb", strokeWidth: 4 },
    image: { width: 260, height: 260 },
    qr: { width: 280, height: 280, stroke: "#dbeafe", strokeWidth: 4, cornerRadius: 24 }
};

const LABELS = { text: "Texte", rect: "Forme", line: "Ligne", image: "Image", qr: "QR" };

export const createObject = (scene, type, overrides = {}) => {
    const defaults = OBJECT_DEFAULTS[type] || {};
    const width = Math.min(overrides.width ?? defaults.width ?? 200, scene.canvas.width - 40);
    const height = overrides.height ?? defaults.height ?? 100;
    // Décale légèrement chaque nouvel élément pour qu'il ne recouvre pas exactement le précédent.
    const cascade = (scene.objects.length % 6) * 24;
    return {
        id: uniqueId(scene, type),
        type,
        label: overrides.label || LABELS[type] || type,
        field: null,
        text: "",
        src: null,
        x: Math.round((scene.canvas.width - width) / 2) + cascade,
        y: Math.round((scene.canvas.height - Math.max(height, 0)) / 2) + cascade,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        fill: "#0f172a",
        stroke: "#cbd5e1",
        strokeWidth: 0,
        fontSize: 32,
        fontFamily: "sans",
        fontWeight: "700",
        align: "left",
        cornerRadius: 0,
        ...defaults,
        ...overrides,
        width,
        zIndex: nextZIndex(scene)
    };
};

export const canAddObject = (scene) => scene.objects.length < MAX_SCENE_OBJECTS;

export const addObject = (scene, object) => (
    canAddObject(scene) ? { ...scene, objects: [...scene.objects, object] } : scene
);

export const updateObject = (scene, id, changes) => ({
    ...scene,
    objects: scene.objects.map(object => object.id === id ? { ...object, ...changes } : object)
});

// Le QR est indispensable au contrôle d'accès : le dernier QR du recto ne peut pas être supprimé.
// Le verso, lui, n'a pas besoin de QR (requireQr = false).
export const canDeleteObject = (scene, id, { requireQr = true } = {}) => {
    const object = scene.objects.find(item => item.id === id);
    if (!object) return false;
    if (object.type !== "qr" || !requireQr) return true;
    return scene.objects.filter(item => item.type === "qr").length > 1;
};

export const deleteObject = (scene, id, options) => (
    canDeleteObject(scene, id, options) ? { ...scene, objects: scene.objects.filter(object => object.id !== id) } : scene
);

export const duplicateObject = (scene, id) => {
    const source = scene.objects.find(object => object.id === id);
    if (!source || !canAddObject(scene)) return { scene, id: null };
    const copy = { ...source, id: uniqueId(scene, source.type), x: source.x + 24, y: source.y + 24, locked: false, zIndex: nextZIndex(scene) };
    return { scene: { ...scene, objects: [...scene.objects, copy] }, id: copy.id };
};

// Réordonne en renumérotant les zIndex de 1 à n.
export const reorderObject = (scene, id, direction) => {
    const ordered = [...scene.objects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const index = ordered.findIndex(object => object.id === id);
    if (index < 0) return scene;
    const [object] = ordered.splice(index, 1);
    const target = direction === "front" ? ordered.length
        : direction === "back" ? 0
        : direction === "forward" ? Math.min(ordered.length, index + 1)
        : Math.max(0, index - 1);
    ordered.splice(target, 0, object);
    const zIndexById = new Map(ordered.map((item, position) => [item.id, position + 1]));
    return { ...scene, objects: scene.objects.map(item => ({ ...item, zIndex: zIndexById.get(item.id) })) };
};

export const moveObjectTo = (object, x, y, scene, grid = 0) => ({
    x: clamp(snapValue(x, grid), -object.width + 10, scene.canvas.width - 10),
    y: clamp(snapValue(y, grid), -Math.abs(object.height) + 10, scene.canvas.height - 10)
});

export const resizeObjectTo = (object, width, height, grid = 0) => {
    // Le serveur impose une largeur positive aux lignes ; la hauteur peut être négative (ligne montante).
    if (object.type === "line") {
        return { width: Math.max(1, snapValue(width, grid)), height: snapValue(height, grid) };
    }
    const nextWidth = Math.max(10, snapValue(width, grid));
    const nextHeight = Math.max(10, snapValue(height, grid));
    // Le QR reste carré pour rester lisible par les scanners.
    if (object.type === "qr") {
        const size = Math.max(nextWidth, nextHeight, 120);
        return { width: size, height: size };
    }
    return { width: nextWidth, height: nextHeight };
};

export const resizeCanvas = (scene, width, height) => ({
    ...scene,
    canvas: { ...scene.canvas, width: clamp(Math.round(width), 240, 2400), height: clamp(Math.round(height), 240, 2600) }
});

// Change de format en conservant la composition : tout le contenu (recto et verso) est mis à
// l'échelle de façon uniforme puis centré dans la nouvelle carte.
export const scaleSceneToCanvas = (scene, width, height) => {
    const target = resizeCanvas(scene, width, height).canvas;
    const scale = Math.min(target.width / scene.canvas.width, target.height / scene.canvas.height);
    const offsetX = (target.width - scene.canvas.width * scale) / 2;
    const offsetY = (target.height - scene.canvas.height * scale) / 2;
    const round = value => Math.round(value * 10) / 10;
    const scaleObjects = (objects) => objects.map(object => ({
        ...object,
        x: round(object.x * scale + offsetX),
        y: round(object.y * scale + offsetY),
        width: Math.max(1, round(object.width * scale)),
        height: round(object.height * scale),
        fontSize: Math.max(6, round((object.fontSize || 32) * scale)),
        strokeWidth: round((object.strokeWidth || 0) * scale),
        cornerRadius: round((object.cornerRadius || 0) * scale)
    }));
    return {
        ...scene,
        canvas: target,
        objects: scaleObjects(scene.objects),
        back: scene.back ? { ...scene.back, objects: scaleObjects(scene.back.objects || []) } : scene.back
    };
};

// ===== Recto / verso =====
// L'éditeur manipule une « vue » { canvas, objects } du côté affiché ; withSide la réintègre.
export const sideView = (scene, side) => {
    if (side !== "back" || !scene.back) return { canvas: scene.canvas, objects: scene.objects };
    return {
        canvas: { ...scene.canvas, backgroundColor: scene.back.backgroundColor || "#ffffff" },
        objects: scene.back.objects || []
    };
};

export const withSide = (scene, side, view) => {
    const canvas = { ...scene.canvas, width: view.canvas.width, height: view.canvas.height };
    if (side !== "back") {
        return { ...scene, canvas: { ...canvas, backgroundColor: view.canvas.backgroundColor }, objects: view.objects };
    }
    return { ...scene, canvas, back: { backgroundColor: view.canvas.backgroundColor, objects: view.objects } };
};

export const addBackSide = (scene) => {
    if (scene.back) return scene;
    const base = { canvas: scene.canvas, objects: [] };
    const intro = createObject(base, "text", {
        label: "Texte du verso",
        text: "Règlement, plan d’accès, partenaires…",
        x: 60,
        y: 60,
        width: Math.max(200, scene.canvas.width - 120),
        height: 120,
        fontSize: 40
    });
    return { ...scene, back: { backgroundColor: "#ffffff", objects: [intro] } };
};

export const removeBackSide = (scene) => ({ ...scene, back: null });
