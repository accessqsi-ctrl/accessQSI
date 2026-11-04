// Fichiers CSV importés : Excel en français enregistre avec des points-virgules et un BOM UTF-8,
// les autres tableurs avec des virgules. Le séparateur est déduit de la ligne d'en-tête.
const detectCsvSeparator = (headerLine = "") => {
    const count = character => headerLine.split(character).length - 1;
    return count(";") > count(",") ? ";" : ",";
};

const readHeaderLine = (text = "") => String(text).replace(/^﻿/, "").split(/\r?\n/, 1)[0];

// Options csv-parser : séparateur détecté, en-têtes sans BOM ni espaces.
const csvParserOptions = (text) => ({
    separator: detectCsvSeparator(readHeaderLine(text)),
    mapHeaders: ({ header }) => header.replace(/^﻿/, "").trim()
});

module.exports = { csvParserOptions, detectCsvSeparator };
