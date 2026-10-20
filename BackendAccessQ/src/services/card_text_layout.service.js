// Mise en page d'un texte dans un cadre : retour à la ligne par mots, réduction de la taille
// si nécessaire, puis troncature avec « … ». Le même algorithme existe côté frontend
// (src/app/lib/cardTextLayout.mjs) pour que l'aperçu de l'éditeur corresponde au PDF.
const PDFDocument = require("pdfkit");
const { fontFilePath, isBoldWeight, normalizeFontId } = require("../config/cardFonts");

const LINE_HEIGHT = 1.2;
const MIN_FONT_RATIO = 0.5;
const ABSOLUTE_MIN_FONT_SIZE = 6;
const ELLIPSIS = "…";

const wrapLines = (text, maxWidth, measure) => {
    const lines = [];
    for (const paragraph of String(text).split(/\r?\n/)) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (!words.length) {
            lines.push("");
            continue;
        }
        let current = "";
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (!current || measure(candidate) <= maxWidth) {
                current = candidate;
            } else {
                lines.push(current);
                current = word;
            }
        }
        lines.push(current);
    }
    return lines;
};

const fits = (lines, fontSize, maxWidth, maxHeight, measure) => (
    lines.length * fontSize * LINE_HEIGHT <= maxHeight + 0.5
    && lines.every(line => measure(line) <= maxWidth + 0.5)
);

const truncateToWidth = (line, maxWidth, measure) => {
    if (measure(line) <= maxWidth) return line;
    let text = line;
    while (text.length > 0 && measure(`${text}${ELLIPSIS}`) > maxWidth) text = text.slice(0, -1);
    return `${text.trimEnd()}${ELLIPSIS}`;
};

// measure(text, fontSize) renvoie la largeur du texte en unités de la carte.
const layoutText = ({ text, width, height, fontSize, measure }) => {
    const content = String(text || "").trim();
    const maxWidth = Math.max(1, Number(width) || 1);
    const maxHeight = Math.max(1, Number(height) || 1);
    const initialSize = Math.max(ABSOLUTE_MIN_FONT_SIZE, Number(fontSize) || 16);
    if (!content) return { fontSize: initialSize, lines: [], lineHeight: initialSize * LINE_HEIGHT };

    const minSize = Math.max(ABSOLUTE_MIN_FONT_SIZE, Math.floor(initialSize * MIN_FONT_RATIO));
    for (let size = initialSize; size >= minSize; size -= Math.max(1, Math.round(size * 0.05))) {
        const measureAt = value => measure(value, size);
        const lines = wrapLines(content, maxWidth, measureAt);
        if (fits(lines, size, maxWidth, maxHeight, measureAt)) {
            return { fontSize: size, lines, lineHeight: size * LINE_HEIGHT };
        }
    }

    // Même à la taille minimale le texte déborde : on garde les lignes qui tiennent.
    const measureAt = value => measure(value, minSize);
    const wrapped = wrapLines(content, maxWidth, measureAt);
    const maxLines = Math.max(1, Math.floor(maxHeight / (minSize * LINE_HEIGHT)));
    const lines = wrapped.slice(0, maxLines).map(line => truncateToWidth(line, maxWidth, measureAt));
    if (wrapped.length > maxLines) {
        lines[maxLines - 1] = truncateToWidth(`${lines[maxLines - 1].replace(new RegExp(`${ELLIPSIS}$`), "")}${ELLIPSIS}`, maxWidth, measureAt);
    }
    return { fontSize: minSize, lines, lineHeight: minSize * LINE_HEIGHT };
};

// Mesure serveur avec les vrais fichiers de police, via un document PDFKit réservé à la mesure.
let measuringDocument = null;
const measureWithFont = (fontId, fontWeight) => {
    if (!measuringDocument) measuringDocument = new PDFDocument({ autoFirstPage: false });
    const file = fontFilePath(normalizeFontId(fontId), isBoldWeight(fontWeight));
    return (text, size) => measuringDocument.font(file).fontSize(size).widthOfString(String(text));
};

module.exports = {
    LINE_HEIGHT,
    layoutText,
    measureWithFont
};
