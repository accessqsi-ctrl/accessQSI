const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
    PDFDocument,
    rgb,
    StandardFonts,
    pushGraphicsState,
    popGraphicsState,
    rectangle,
    clip,
    endPath
} = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const pdfTemplates = require("../config/pdfTemplates");

const templateDir = path.join(__dirname, "../statics/pdf-templates");
const outputDir = path.join(__dirname, "../statics/generated-documents");
const regularFontPath = path.join(__dirname, "../statics/fonts/LiberationSans-Regular.ttf");
const boldFontPath = path.join(__dirname, "../statics/fonts/LiberationSans-Bold.ttf");

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value)));

const getTemplate = (templateId) => pdfTemplates[String(templateId || "").trim()] || null;

const listTemplates = () => Object.values(pdfTemplates).map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description || "",
    fields: Object.fromEntries(Object.entries(template.fields || {}).map(([key, field]) => [
        key,
        {
            type: field.type,
            required: field.required === true,
            label: field.label || key,
            align: field.align || "left"
        }
    ]))
}));

function resolveNormalizedField(page, field) {
    const { width, height } = page.getSize();

    return {
        x: width * clamp01(field.x),
        y: height * clamp01(field.y),
        width:
            field.width !== undefined
                ? width * clamp01(field.width)
                : undefined,
        height:
            field.height !== undefined
                ? height * clamp01(field.height)
                : undefined,
        fontSize:
            field.fontSizeRatio !== undefined
                ? height * Number(field.fontSizeRatio)
                : undefined
    };
}

const sanitizeText = (value) => String(value ?? "").trim().slice(0, 500);

function drawTextInZone({
    page,
    text,
    font,
    field,
    color = rgb(0.08, 0.1, 0.14)
}) {
    const value = sanitizeText(text);
    if (!value) return null;

    const resolved = resolveNormalizedField(page, field);
    const maxWidth = resolved.width || page.getSize().width;
    const minFontSize = Number(field.minFontSize || 7);
    let fontSize = Math.max(minFontSize, Number(resolved.fontSize || field.fontSize || 12));

    while (
        font.widthOfTextAtSize(value, fontSize) > maxWidth &&
        fontSize > minFontSize
    ) {
        fontSize -= 0.5;
    }

    const textWidth = font.widthOfTextAtSize(value, fontSize);
    const align = field.align || "left";
    let x = resolved.x;

    if (align === "center") {
        x = resolved.x + Math.max(0, (maxWidth - textWidth) / 2);
    } else if (align === "right") {
        x = resolved.x + Math.max(0, maxWidth - textWidth);
    }

    page.drawText(value, {
        x,
        y: resolved.y,
        size: fontSize,
        font,
        color
    });

    return { x, y: resolved.y, fontSize, width: textWidth };
}

const parseImageData = (value) => {
    if (!value) return null;
    const source = Buffer.isBuffer(value) ? value.toString("base64") : String(value);
    const match = source.match(/^data:(image\/png|image\/jpe?g);base64,(.+)$/i);
    if (!match) return null;
    return {
        mimeType: match[1].toLowerCase(),
        bytes: Buffer.from(match[2], "base64")
    };
};

const drawImageInZone = async ({ pdfDoc, page, imageValue, field }) => {
    const imageData = parseImageData(imageValue);
    if (!imageData) return null;

    const image = imageData.mimeType.includes("png")
        ? await pdfDoc.embedPng(imageData.bytes)
        : await pdfDoc.embedJpg(imageData.bytes);

    const resolved = resolveNormalizedField(page, field);
    const boxWidth = resolved.width || image.width;
    const boxHeight = resolved.height || image.height;
    const imageRatio = image.width / image.height;
    const boxRatio = boxWidth / boxHeight;

    let drawWidth = boxWidth;
    let drawHeight = boxHeight;

    if (field.objectFit === "contain") {
        if (imageRatio > boxRatio) {
            drawHeight = boxWidth / imageRatio;
        } else {
            drawWidth = boxHeight * imageRatio;
        }
    } else if (field.objectFit === "cover") {
        if (imageRatio > boxRatio) {
            drawWidth = boxHeight * imageRatio;
        } else {
            drawHeight = boxWidth / imageRatio;
        }
    }

    page.pushOperators(
        pushGraphicsState(),
        rectangle(resolved.x, resolved.y, boxWidth, boxHeight),
        clip(),
        endPath()
    );

    page.drawImage(image, {
        x: resolved.x + (boxWidth - drawWidth) / 2,
        y: resolved.y + (boxHeight - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight
    });

    page.pushOperators(popGraphicsState());

    return { width: drawWidth, height: drawHeight };
};

const loadFonts = async (pdfDoc) => {
    pdfDoc.registerFontkit(fontkit);

    if (fs.existsSync(regularFontPath) && fs.existsSync(boldFontPath)) {
        const [regularBytes, boldBytes] = await Promise.all([
            fs.promises.readFile(regularFontPath),
            fs.promises.readFile(boldFontPath)
        ]);

        return {
            regular: await pdfDoc.embedFont(regularBytes),
            bold: await pdfDoc.embedFont(boldBytes)
        };
    }

    return {
        regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
        bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    };
};

const templatePathFor = (template) => path.join(templateDir, template.filename);

const templatePathForId = (templateId) => {
    const template = getTemplate(templateId);
    return template ? templatePathFor(template) : null;
};

const ensureOutputDir = async () => {
    await fs.promises.mkdir(outputDir, { recursive: true });
};

const generatedFilename = (templateId) => {
    const safeTemplateId = String(templateId).replace(/[^a-zA-Z0-9_-]/g, "");
    return `document_${safeTemplateId}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}.pdf`;
};

const assertRequiredFields = (template, values) => {
    for (const [key, field] of Object.entries(template.fields || {})) {
        if (field.required && !sanitizeText(values[key])) {
            const error = new Error(`Champ requis manquant: ${key}`);
            error.statusCode = 400;
            throw error;
        }
    }
};

const generateDocument = async ({ templateId, values = {} }) => {
    const template = getTemplate(templateId);
    if (!template) {
        const error = new Error("Modèle PDF invalide.");
        error.statusCode = 400;
        throw error;
    }

    const sourcePath = templatePathFor(template);
    if (!fs.existsSync(sourcePath)) {
        const error = new Error("Fichier du modèle PDF introuvable côté serveur.");
        error.statusCode = 500;
        throw error;
    }

    assertRequiredFields(template, values);

    const sourceBytes = await fs.promises.readFile(sourcePath);
    const pdfDoc = await PDFDocument.load(sourceBytes);
    const fonts = await loadFonts(pdfDoc);
    const pages = pdfDoc.getPages();

    for (const [key, field] of Object.entries(template.fields || {})) {
        const page = pages[field.page || 0];
        if (!page) continue;

        if (field.type === "text") {
            drawTextInZone({
                page,
                text: values[key],
                font: field.fontWeight === "bold" ? fonts.bold : fonts.regular,
                field
            });
        }

        if (field.type === "image") {
            await drawImageInZone({
                pdfDoc,
                page,
                imageValue: values[key],
                field
            });
        }
    }

    await ensureOutputDir();
    const filename = generatedFilename(template.id);
    const outputPath = path.join(outputDir, filename);
    const outputBytes = await pdfDoc.save();
    await fs.promises.writeFile(outputPath, outputBytes);

    return {
        filename,
        url: `/generated-documents/${filename}`,
        downloadUrl: `/generated-documents/${filename}/download`
    };
};

const generatedPathForFilename = (filename) => path.join(outputDir, filename);

module.exports = {
    getTemplate,
    listTemplates,
    resolveNormalizedField,
    drawTextInZone,
    generateDocument,
    templatePathForId,
    generatedPathForFilename
};
