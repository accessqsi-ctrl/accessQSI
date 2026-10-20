// Polices disponibles dans l'éditeur de cartes (licence SIL OFL, fichiers dans src/assets/fonts).
// Les mêmes fichiers sont servis par le frontend (public/fonts) pour que l'éditeur et le PDF
// mesurent et affichent le texte à l'identique. Pour ajouter une police : déposer les fichiers
// des deux côtés et ajouter une entrée ici et dans frontendAccessQ/src/app/lib/cardFonts.mjs.
const path = require("path");

const fontDir = path.join(__dirname, "../assets/fonts");

const CARD_FONTS = Object.freeze({
    sans: { label: "Moderne", regular: "LiberationSans-Regular.ttf", bold: "LiberationSans-Bold.ttf" },
    serif: { label: "Classique", regular: "LiberationSerif-Regular.ttf", bold: "LiberationSerif-Bold.ttf" },
    rounded: { label: "Arrondie", regular: "Quicksand-Regular.ttf", bold: "Quicksand-Bold.ttf" },
    elegant: { label: "Élégante", regular: "Yrsa-Regular.ttf", bold: "Yrsa-Bold.ttf" }
});

const DEFAULT_FONT = "sans";

// Les scènes enregistrées avant l'éditeur utilisaient des noms de polices système.
const LEGACY_FONT_ALIASES = Object.freeze({
    arial: "sans",
    helvetica: "sans",
    "sans-serif": "sans",
    times: "serif",
    "times new roman": "serif",
    georgia: "serif",
    serif: "serif"
});

const normalizeFontId = (value) => {
    const key = String(value || "").trim().toLowerCase();
    if (CARD_FONTS[key]) return key;
    return LEGACY_FONT_ALIASES[key] || DEFAULT_FONT;
};

const isBoldWeight = (weight) => {
    const value = String(weight || "").trim().toLowerCase();
    return value === "bold" || value === "bolder" || Number(value) >= 600;
};

const fontFilePath = (fontId, bold = false) => {
    const font = CARD_FONTS[normalizeFontId(fontId)];
    return path.join(fontDir, bold ? font.bold : font.regular);
};

// Famille utilisée dans le SVG ; svg-to-pdfkit résout « famille » et « famille-Bold » parmi les
// polices enregistrées dans le document PDFKit.
const svgFontFamily = (fontId) => `aq-${normalizeFontId(fontId)}`;

module.exports = {
    CARD_FONTS,
    DEFAULT_FONT,
    fontFilePath,
    isBoldWeight,
    normalizeFontId,
    svgFontFamily
};
