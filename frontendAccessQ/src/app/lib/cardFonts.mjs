// Polices de l'éditeur de cartes. Les fichiers (public/fonts) sont identiques à ceux du backend
// (BackendAccessQ/src/assets/fonts, registre src/config/cardFonts.js) : l'éditeur mesure et
// affiche le texte exactement comme le PDF final.
export const CARD_FONTS = [
    { id: "sans", label: "Moderne", family: "aq-sans" },
    { id: "serif", label: "Classique", family: "aq-serif" },
    { id: "rounded", label: "Arrondie", family: "aq-rounded" },
    { id: "elegant", label: "Élégante", family: "aq-elegant" }
];

const legacyAliases = {
    arial: "sans",
    helvetica: "sans",
    "sans-serif": "sans",
    times: "serif",
    "times new roman": "serif",
    georgia: "serif",
    serif: "serif"
};

export const normalizeFontId = (value) => {
    const key = String(value || "").trim().toLowerCase();
    if (CARD_FONTS.some(font => font.id === key)) return key;
    return legacyAliases[key] || "sans";
};

export const fontFamilyFor = (fontId) => `aq-${normalizeFontId(fontId)}`;

export const isBoldWeight = (weight) => {
    const value = String(weight || "").trim().toLowerCase();
    return value === "bold" || value === "bolder" || Number(value) >= 600;
};
