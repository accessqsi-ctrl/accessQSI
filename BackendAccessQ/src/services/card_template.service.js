const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");
const storageService = require("./storage.service");

const templates = {
    "event-ticket": {
        id: "event-ticket",
        width: 1600,
        height: 600,
        accent: "#2563eb",
        soft: "#dbeafe",
        ink: "#0f172a",
        surface: "#f8fafc",
        label: "BILLET"
    },
    "access-pass": {
        id: "access-pass",
        width: 1600,
        height: 600,
        accent: "#d97706",
        soft: "#fef3c7",
        ink: "#111827",
        surface: "#fffbeb",
        label: "PASS"
    },
    "staff-card": {
        id: "staff-card",
        width: 900,
        height: 1400,
        accent: "#059669",
        soft: "#d1fae5",
        ink: "#0f172a",
        surface: "#f8fafc",
        label: "STAFF"
    },
    "staff-badge-horizontal": {
        id: "staff-badge-horizontal",
        width: 1600,
        height: 600,
        accent: "#0f766e",
        soft: "#ccfbf1",
        ink: "#0f172a",
        surface: "#f8fafc",
        label: "BADGE STAFF"
    },
    "wedding-invite": {
        id: "wedding-invite",
        width: 1200,
        height: 1800,
        accent: "#e11d48",
        soft: "#ffe4e6",
        ink: "#881337",
        surface: "#fff7f8",
        label: "INVITATION"
    },
    "wedding-modern-navy-beige": {
        id: "wedding-modern-navy-beige",
        width: 1240,
        height: 1748,
        accent: "#080d5f",
        soft: "#e7bd62",
        ink: "#080d5f",
        surface: "#ffffff",
        label: "INVITATION MARIAGE"
    },
    "vip-invitation": {
        id: "vip-invitation",
        width: 1200,
        height: 1800,
        accent: "#7c3aed",
        soft: "#ede9fe",
        ink: "#2e1065",
        surface: "#faf5ff",
        label: "INVITATION VIP"
    },
    "simple-invitation": {
        id: "simple-invitation",
        width: 1200,
        height: 1800,
        accent: "#334155",
        soft: "#e2e8f0",
        ink: "#0f172a",
        surface: "#f8fafc",
        label: "INVITATION"
    },
    "vip-pass": {
        id: "vip-pass",
        width: 1600,
        height: 600,
        accent: "#9333ea",
        soft: "#f3e8ff",
        ink: "#2e1065",
        surface: "#faf5ff",
        label: "PASS VIP"
    },
    "compact-ticket": {
        id: "compact-ticket",
        width: 1200,
        height: 520,
        accent: "#1d4ed8",
        soft: "#dbeafe",
        ink: "#0f172a",
        surface: "#f8fafc",
        label: "TICKET"
    }
};

const escapeXml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const imageHrefForSvg = (href) => {
    const cleanHref = String(href || "").split("?")[0].trim();
    if (!cleanHref || cleanHref.startsWith("data:") || /^https?:\/\//i.test(cleanHref)) {
        return cleanHref;
    }

    const normalizedHref = cleanHref.startsWith("/") ? cleanHref.slice(1) : cleanHref;
    const candidate = storageService.findPublicAsset(...normalizedHref.split("/"));
    if (!candidate || !fs.statSync(candidate).isFile()) {
        return cleanHref;
    }

    const mimeTypes = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp"
    };
    const mimeType = mimeTypes[path.extname(candidate).toLowerCase()];
    if (!mimeType) return cleanHref;
    return `data:${mimeType};base64,${fs.readFileSync(candidate).toString("base64")}`;
};

const renderPrimaryImage = ({ template, clipId, clipContent, x, y, width, height }) => {
    if (template.id === "wedding-invite") return "";
    const href = imageHrefForSvg(template.backgroundImageUrl);
    if (!href) return "";

    return `<defs><clipPath id="${clipId}">${clipContent}</clipPath></defs>
<image href="${escapeXml(href)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`;
};

const formatDate = (value) => {
    if (!value) return "Date a definir";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date a definir";
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
};

const getEventDate = (event) => {
    const schedule = event?.EventSchedules?.[0];
    return formatDate(schedule?.start_date);
};

const getEventLocation = (event) => {
    const schedules = event?.EventSchedules || [];
    const location = schedules.map(schedule => schedule.area?.area_name).filter(Boolean).join(", ");
    return location || "Zone a definir";
};

const getEventStartDate = (event) => {
    const schedule = event?.EventSchedules?.[0];
    const date = schedule?.start_date ? new Date(schedule.start_date) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
};

const getWeddingCardData = (qrRecord, cardData = {}) => {
    const source = {
        ...(qrRecord?.card_data && typeof qrRecord.card_data === "object" ? qrRecord.card_data : {}),
        ...(cardData && typeof cardData === "object" ? cardData : {})
    };
    return {
        spouseOne: String(source.spouseOne || source.nom1 || "NOM 1").trim(),
        spouseTwo: String(source.spouseTwo || source.nom2 || "NOM 2").trim(),
        zone: String(source.zone || "ZONE").trim(),
        address: String(source.address || source.adresse || "Adresse").trim()
    };
};

const getCardMessage = (message, fallback = "Présentez ce QR à l'entrée") => {
    const trimmed = String(message || "").trim();
    return escapeXml(trimmed || fallback);
};

const cardFilenameForToken = (token) => `card_${token}.svg`;

const cardPdfFilenameForToken = (token) => `card_${token}.pdf`;

const cardPathForToken = (token) => storageService.storagePath("cards", cardFilenameForToken(token));

const cardPdfPathForToken = (token) => storageService.storagePath("cards", cardPdfFilenameForToken(token));

const cardUrlForToken = (token) => `/cards/${cardFilenameForToken(token)}`;

const cardPdfUrlForToken = (token) => `/cards/${cardPdfFilenameForToken(token)}`;

const hasTemplate = (templateId) => Boolean(templates[templateId]);
const availableTemplateIds = new Set([
    "event-ticket", "staff-card", "wedding-invite", "compact-ticket"
]);
const isTemplateAvailable = (templateId) => availableTemplateIds.has(String(templateId || ""));

const extractCustomTemplateId = (templateId) => {
    const match = String(templateId || "").match(/^custom:(\d+)$/);
    return match ? Number(match[1]) : null;
};

const getTemplate = (templateId) => templates[templateId] || null;

const buildTemplate = (templateId, customization = null) => {
    const template = getTemplate(templateId);
    if (!template) return null;
    if (!customization) return template;

    return {
        ...template,
        baseAccent: template.accent,
        accent: customization.primaryColor || template.accent,
        soft: customization.secondaryColor || template.soft,
        label: customization.title || template.label,
        logoUrl: customization.logoUrl || "",
        backgroundImageUrl: customization.backgroundImageUrl || "",
        qrPosition: customization.qrPosition || "right",
        visibleFields: customization.visibleFields || {},
        layoutConfig: customization.layoutConfig || null,
        canvasScene: customization.canvasScene || null,
        cardMessageDefault: customization.cardMessageDefault || ""
    };
};

const isFieldVisible = (template, field) => template.visibleFields?.[field] !== false;

const fieldText = (template, field, value) => isFieldVisible(template, field) ? value : "";

const renderLogo = (template, x, y, size = 62) => {
    if (!template.logoUrl) return "";
    return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="14" fill="#ffffff" opacity="0.96"/>
<image href="${escapeXml(template.logoUrl)}" x="${x + 7}" y="${y + 7}" width="${size - 14}" height="${size - 14}" preserveAspectRatio="xMidYMid meet"/>`;
};

const renderTextElement = (element, value) => {
    const text = escapeXml(value);
    const anchor = element.align === "center" ? "middle" : element.align === "right" ? "end" : "start";
    const x = element.align === "center" ? element.x + element.width / 2 : element.align === "right" ? element.x + element.width : element.x;
    const y = element.y + element.fontSize;
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="${element.fontSize}" font-weight="${escapeXml(element.fontWeight)}" fill="${escapeXml(element.color)}" opacity="${element.opacity ?? 1}">${text}</text>`;
};

const getLayoutValue = ({ element, template, event, qrRecord, cardMessage }) => {
    const values = {
        title: template.label,
        event: event.title,
        holder: qrRecord.holder_name || "Invité",
        date: getEventDate(event),
        location: getEventLocation(event),
        level: `Niveau ${qrRecord.level || 1}`,
        message: String(cardMessage || template.cardMessageDefault || "Présentez ce QR à l'entrée").trim(),
        cardId: `QR-${qrRecord.qr_id}`
    };
    return values[element.type] || element.label || "";
};

const getCanvasValue = ({ object, template, event, qrRecord, cardMessage }) => {
    const values = {
        title: template.label,
        event: event.title,
        holder: qrRecord.holder_name || "Invité",
        date: getEventDate(event),
        location: getEventLocation(event),
        level: `Niveau ${qrRecord.level || 1}`,
        message: String(cardMessage || template.cardMessageDefault || "Présentez ce QR à l'entrée").trim(),
        cardId: `QR-${qrRecord.qr_id}`
    };
    const field = object.field && values[object.field] ? values[object.field] : "";
    const rawText = String(object.text || field || object.label || "");
    return rawText.replace(/\{\{\s*(title|event|holder|date|location|level|message|cardId)\s*\}\}/g, (_, key) => values[key] || "");
};

const transformForObject = (object) => {
    const rotation = Number(object.rotation || 0);
    if (!rotation) return "";
    const cx = Number(object.x || 0) + Number(object.width || 0) / 2;
    const cy = Number(object.y || 0) + Number(object.height || 0) / 2;
    return ` transform="rotate(${rotation} ${cx} ${cy})"`;
};

const renderCanvasText = ({ object, template, event, qrRecord, cardMessage }) => {
    const anchor = object.align === "center" ? "middle" : object.align === "right" ? "end" : "start";
    const x = object.align === "center" ? object.x + object.width / 2 : object.align === "right" ? object.x + object.width : object.x;
    const y = object.y + object.fontSize;
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${escapeXml(object.fontFamily || "Arial")}, sans-serif" font-size="${object.fontSize}" font-weight="${escapeXml(object.fontWeight || "700")}" fill="${escapeXml(object.fill || template.ink)}">${escapeXml(getCanvasValue({ object, template, event, qrRecord, cardMessage }))}</text>`;
};

const renderCanvasScene = ({ template, qrUrl, event, qrRecord, cardMessage }) => {
    const scene = template.canvasScene;
    const canvas = scene?.canvas || {};
    const width = Number(canvas.width || template.width);
    const height = Number(canvas.height || template.height);
    const backgroundColor = escapeXml(canvas.backgroundColor || template.surface || "#ffffff");
    const objects = Array.isArray(scene?.objects) ? scene.objects : [];
    const renderedObjects = objects
        .filter(object => object && object.visible !== false)
        .slice()
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
        .map((object) => {
            const opacity = object.opacity ?? 1;
            const transform = transformForObject(object);
            const common = `opacity="${opacity}"${transform}`;

            if (object.type === "background") {
                const src = object.src || (template.id === "wedding-invite" ? "" : template.backgroundImageUrl);
                if (src) return `<image href="${escapeXml(imageHrefForSvg(src))}" x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" preserveAspectRatio="xMidYMid slice" ${common}/>`;
                return `<rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" fill="${escapeXml(object.fill || backgroundColor)}" ${common}/>`;
            }

            if (object.type === "image" || object.type === "logo") {
                const src = object.src || (object.type === "logo" ? template.logoUrl : "");
                if (!src) return "";
                return `<image href="${escapeXml(src)}" x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" preserveAspectRatio="xMidYMid meet" ${common}/>`;
            }

            if (object.type === "qr") {
                return `<g ${common}><rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${object.cornerRadius || 18}" fill="#ffffff" stroke="${escapeXml(object.stroke || template.soft)}" stroke-width="${object.strokeWidth || 4}"/>
<image href="${qrUrl}" x="${object.x + 16}" y="${object.y + 16}" width="${Math.max(20, object.width - 32)}" height="${Math.max(20, object.height - 32)}" preserveAspectRatio="xMidYMid meet"/></g>`;
            }

            if (object.type === "rect") {
                const objectFill = String(object.fill || "").toLowerCase();
                const usesPrimaryColor = objectFill === String(template.accent || "").toLowerCase()
                    || objectFill === String(template.baseAccent || "").toLowerCase()
                    || String(object.id || "").toLowerCase().includes("accent");
                const clipId = `primary-object-${String(object.id || object.zIndex || "rect").replace(/[^a-zA-Z0-9_-]/g, "")}`;
                const primaryImage = usesPrimaryColor ? renderPrimaryImage({
                    template,
                    clipId,
                    clipContent: `<rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${object.cornerRadius || 0}"${transform}/>`,
                    x: object.x,
                    y: object.y,
                    width: object.width,
                    height: object.height
                }) : "";
                if (primaryImage) {
                    return `${primaryImage}
<rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${object.cornerRadius || 0}" fill="none" stroke="${escapeXml(object.stroke || "none")}" stroke-width="${object.strokeWidth || 0}" ${common}/>`;
                }
                return `<rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${object.cornerRadius || 0}" fill="${escapeXml(object.fill || "#ffffff")}" stroke="${escapeXml(object.stroke || "none")}" stroke-width="${object.strokeWidth || 0}" ${common}/>`;
            }

            if (object.type === "line") {
                return `<line x1="${object.x}" y1="${object.y}" x2="${object.x + object.width}" y2="${object.y + object.height}" stroke="${escapeXml(object.stroke || object.fill || template.accent)}" stroke-width="${object.strokeWidth || 4}" stroke-linecap="round" ${common}/>`;
            }

            if (object.type === "text") {
                return `<g ${common}>${renderCanvasText({ object, template, event, qrRecord, cardMessage })}</g>`;
            }

            return "";
        })
        .join("\n");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${backgroundColor}"/>
${renderedObjects}
</svg>`;
};

const renderLayoutCard = ({ template, qrUrl, event, qrRecord, cardMessage }) => {
    const elements = Array.isArray(template.layoutConfig?.elements) ? template.layoutConfig.elements : [];
    const background = `<rect width="${template.width}" height="${template.height}" rx="34" fill="${template.surface}"/>
<rect x="40" y="40" width="${template.width - 80}" height="${template.height - 80}" rx="28" fill="#ffffff" stroke="${template.soft}" stroke-width="4"/>`;
    const primaryZones = {
        "event-ticket": {
            clipId: "layout-event-primary-zone",
            clipContent: `<rect x="40" y="40" width="420" height="${template.height - 80}" rx="28"/>`,
            x: 40, y: 40, width: 420, height: template.height - 80
        },
        "staff-card": {
            clipId: "layout-staff-primary-zone",
            clipContent: `<rect x="54" y="54" width="${template.width - 108}" height="396" rx="52"/>`,
            x: 54, y: 54, width: template.width - 108, height: 396
        },
        "compact-ticket": {
            clipId: "layout-compact-primary-zone",
            clipContent: `<rect x="36" y="36" width="280" height="${template.height - 72}" rx="26"/>`,
            x: 36, y: 36, width: 280, height: template.height - 72
        }
    };
    const primaryZone = primaryZones[template.id]
        ? renderPrimaryImage({ template, ...primaryZones[template.id] })
        : "";

    const renderedElements = elements
        .filter(element => element.visible !== false)
        .slice()
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
        .map((element) => {
            if (element.type === "qr") {
                return `<g opacity="${element.opacity ?? 1}"><rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="24" fill="#ffffff" stroke="${template.soft}" stroke-width="5"/>
<image href="${qrUrl}" x="${element.x + 18}" y="${element.y + 18}" width="${Math.max(20, element.width - 36)}" height="${Math.max(20, element.height - 36)}" preserveAspectRatio="xMidYMid meet"/></g>`;
            }
            if (element.type === "logo") {
                const logoUrl = template.logoUrl;
                if (!logoUrl) return "";
                return `<g opacity="${element.opacity ?? 1}"><rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="18" fill="#ffffff" opacity="0.94"/>
<image href="${escapeXml(logoUrl)}" x="${element.x + 8}" y="${element.y + 8}" width="${Math.max(20, element.width - 16)}" height="${Math.max(20, element.height - 16)}" preserveAspectRatio="xMidYMid meet"/></g>`;
            }
            return renderTextElement(element, getLayoutValue({ element, template, event, qrRecord, cardMessage }));
        })
        .join("\n");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
${background}
${primaryZone}
${renderedElements}
</svg>`;
};

const renderHorizontalTicket = ({ template, qrUrl, event, qrRecord, cardMessage }) => {
    const title = escapeXml(event.title);
    const holder = escapeXml(qrRecord.holder_name);
    const date = escapeXml(getEventDate(event));
    const location = escapeXml(getEventLocation(event));
    const level = escapeXml(qrRecord.level || 1);
    const message = getCardMessage(cardMessage, template.cardMessageDefault || (template.id.includes("pass") ? "Accès à présenter au contrôle" : "Présentez ce QR à l'entrée"));
    const qrOnLeft = template.qrPosition === "left";
    const contentX = qrOnLeft ? 820 : 540;
    const qrX = qrOnLeft ? 540 : template.width - 330;
    const primaryPanel = renderPrimaryImage({
        template,
        clipId: "horizontal-primary-zone",
        clipContent: `<rect x="40" y="40" width="420" height="${template.height - 80}" rx="28"/>
<path d="M432 40 h28 v${template.height - 80} h-28 a28 28 0 0 0 28 -28 v-${template.height - 136} a28 28 0 0 0 -28 -28z"/>`,
        x: 40,
        y: 40,
        width: 420,
        height: template.height - 80
    }) || `<rect x="40" y="40" width="420" height="${template.height - 80}" rx="28" fill="${template.accent}"/>
<path d="M432 40 h28 v${template.height - 80} h-28 a28 28 0 0 0 28 -28 v-${template.height - 136} a28 28 0 0 0 -28 -28z" fill="${template.accent}"/>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
<rect width="${template.width}" height="${template.height}" rx="34" fill="${template.surface}"/>
<rect x="40" y="40" width="${template.width - 80}" height="${template.height - 80}" rx="28" fill="#ffffff" stroke="#dbe3ea" stroke-width="3"/>
${primaryPanel}
<circle cx="134" cy="134" r="72" fill="#ffffff" opacity="0.14"/>
<circle cx="400" cy="${template.height - 118}" r="118" fill="#ffffff" opacity="0.10"/>
<text x="92" y="182" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#ffffff" opacity="0.82">AccessQ</text>
${renderLogo(template, 92, 74, 64)}
<text x="92" y="276" font-family="Arial, sans-serif" font-size="50" font-weight="800" fill="#ffffff">${template.label}</text>
<text x="92" y="326" font-family="Arial, sans-serif" font-size="22" fill="#ffffff" opacity="0.82">Support numérique sécurisé</text>
<text x="${contentX}" y="120" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="${template.accent}">${template.label} NUMÉRIQUE</text>
<text x="${contentX}" y="205" font-family="Arial, sans-serif" font-size="54" font-weight="900" fill="${template.ink}">${fieldText(template, "event", title)}</text>
<text x="${contentX}" y="272" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#334155">${fieldText(template, "holder", holder)}</text>
<rect x="${contentX}" y="326" width="470" height="112" rx="22" fill="${template.soft}" opacity="0.62"/>
<text x="${contentX + 30}" y="374" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#334155">${fieldText(template, "date", date)}</text>
<text x="${contentX + 30}" y="414" font-family="Arial, sans-serif" font-size="22" fill="#475569">${fieldText(template, "location", location)}</text>
<text x="${contentX}" y="492" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="${template.accent}">${fieldText(template, "level", `Niveau ${level}`)}</text>
<text x="${contentX}" y="536" font-family="Arial, sans-serif" font-size="19" fill="#64748b">${fieldText(template, "message", message)}</text>
${isFieldVisible(template, "qr") ? `<rect x="${qrX}" y="128" width="238" height="238" rx="28" fill="#ffffff" stroke="#dbe3ea" stroke-width="4"/>
<image href="${qrUrl}" x="${qrX + 28}" y="156" width="182" height="182"/>
<text x="${qrX}" y="424" font-family="Arial, sans-serif" font-size="21" font-weight="700" fill="#475569">QR-${qrRecord.qr_id}</text>` : ""}
<line x1="${template.width - 420}" y1="76" x2="${template.width - 420}" y2="${template.height - 76}" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="16 16"/>
</svg>`;
};

const renderVerticalCard = ({ template, qrUrl, event, qrRecord, cardMessage }) => {
    const title = escapeXml(event.title);
    const holder = escapeXml(qrRecord.holder_name);
    const location = escapeXml(getEventLocation(event));
    const level = escapeXml(qrRecord.level || 1);
    const message = getCardMessage(cardMessage, template.cardMessageDefault || "Badge à présenter au contrôle");
    const primaryPanel = renderPrimaryImage({
        template,
        clipId: "vertical-primary-zone",
        clipContent: `<rect x="54" y="54" width="${template.width - 108}" height="360" rx="52"/>
<rect x="54" y="330" width="${template.width - 108}" height="120"/>`,
        x: 54,
        y: 54,
        width: template.width - 108,
        height: 396
    }) || `<rect x="54" y="54" width="${template.width - 108}" height="360" rx="52" fill="${template.accent}"/>
<rect x="54" y="330" width="${template.width - 108}" height="120" fill="${template.accent}"/>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
<rect width="${template.width}" height="${template.height}" rx="64" fill="${template.surface}"/>
<rect x="54" y="54" width="${template.width - 108}" height="${template.height - 108}" rx="52" fill="#ffffff" stroke="#dbe3ea" stroke-width="4"/>
${primaryPanel}
<text x="450" y="154" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="800" fill="#ffffff">AccessQ</text>
${renderLogo(template, 78, 78, 70)}
<text x="450" y="218" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#ffffff" opacity="0.84">${template.label}</text>
<circle cx="450" cy="390" r="144" fill="#ffffff"/>
<circle cx="450" cy="390" r="116" fill="${template.soft}"/>
<text x="450" y="418" text-anchor="middle" font-family="Arial, sans-serif" font-size="78" font-weight="900" fill="${template.accent}">${holder.slice(0, 1).toUpperCase()}</text>
<text x="450" y="615" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="900" fill="${template.ink}">${fieldText(template, "holder", holder)}</text>
<text x="450" y="682" text-anchor="middle" font-family="Arial, sans-serif" font-size="29" font-weight="700" fill="${template.accent}">${fieldText(template, "level", `Niveau ${level}`)}</text>
<text x="450" y="762" text-anchor="middle" font-family="Arial, sans-serif" font-size="29" fill="#334155">${fieldText(template, "event", title)}</text>
<text x="450" y="814" text-anchor="middle" font-family="Arial, sans-serif" font-size="23" fill="#64748b">${fieldText(template, "location", location)}</text>
${isFieldVisible(template, "qr") ? `<rect x="250" y="890" width="400" height="400" rx="38" fill="#ffffff" stroke="#dbe3ea" stroke-width="6"/>
<image href="${qrUrl}" x="292" y="932" width="316" height="316"/>
<text x="450" y="1348" text-anchor="middle" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="#475569">QR-${qrRecord.qr_id}</text>` : ""}
<text x="450" y="1392" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#64748b">${fieldText(template, "message", message)}</text>
</svg>`;
};

const renderWeddingInvite = ({ template, qrUrl, event, qrRecord, cardMessage }) => {
    const title = escapeXml(event.title);
    const holder = escapeXml(qrRecord.holder_name);
    const date = escapeXml(getEventDate(event));
    const location = escapeXml(getEventLocation(event));
    const message = getCardMessage(cardMessage, template.cardMessageDefault || "Présentez ce QR à l'entrée");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
<rect width="1200" height="1800" fill="${template.surface}"/>
<rect x="70" y="70" width="1060" height="1660" rx="58" fill="#ffffff" stroke="${template.soft}" stroke-width="10"/>
<rect x="112" y="112" width="976" height="1576" rx="42" fill="none" stroke="${template.accent}" stroke-width="2" opacity="0.28"/>
<circle cx="176" cy="206" r="82" fill="${template.soft}"/>
<circle cx="1028" cy="1598" r="132" fill="${template.soft}"/>
${renderLogo(template, 130, 128, 72)}
<text x="600" y="252" text-anchor="middle" font-family="Georgia, serif" font-size="38" font-style="italic" fill="${template.accent}">${template.label}</text>
<text x="600" y="390" text-anchor="middle" font-family="Georgia, serif" font-size="74" font-weight="700" fill="${template.ink}">${fieldText(template, "event", title)}</text>
<text x="600" y="542" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#64748b">Invité</text>
<text x="600" y="612" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="800" fill="#0f172a">${fieldText(template, "holder", holder)}</text>
<rect x="210" y="720" width="780" height="150" rx="34" fill="${template.soft}" opacity="0.74"/>
<text x="600" y="780" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#334155">${fieldText(template, "date", date)}</text>
<text x="600" y="832" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#64748b">${fieldText(template, "location", location)}</text>
${isFieldVisible(template, "qr") ? `<rect x="420" y="1010" width="360" height="360" rx="36" fill="#ffffff" stroke="${template.soft}" stroke-width="7"/>
<image href="${qrUrl}" x="458" y="1048" width="284" height="284"/>
<text x="600" y="1530" text-anchor="middle" font-family="Arial, sans-serif" font-size="21" fill="#64748b">QR-${qrRecord.qr_id}</text>` : ""}
<text x="600" y="1464" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${template.accent}">${fieldText(template, "message", message)}</text>
</svg>`;
};

const renderModernNavyWeddingInvite = ({ template, qrUrl, event, qrRecord, cardData }) => {
    const data = getWeddingCardData(qrRecord, cardData);
    const date = getEventStartDate(event);
    const dayName = date ? date.toLocaleDateString("fr-FR", { weekday: "long" }).toUpperCase() : "DIMANCHE";
    const month = date ? date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").toUpperCase() : "DÉC";
    const day = date ? String(date.getDate()).padStart(2, "0") : "15";
    const year = date ? String(date.getFullYear()) : "2030";
    const hour = date ? `${String(date.getHours()).padStart(2, "0")}H${String(date.getMinutes()).padStart(2, "0")}` : "19H00";
    const backgroundUrl = "/card-backgrounds/wedding-modern-navy-beige.png";

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
<image href="${backgroundUrl}" x="0" y="0" width="${template.width}" height="${template.height}" preserveAspectRatio="xMidYMid slice"/>
<text x="620" y="407" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-style="italic" font-weight="700" letter-spacing="3" fill="${template.ink}">JE T'INVITE À NOTRE MARIAGE</text>
<text x="620" y="616" text-anchor="middle" font-family="Georgia, serif" font-size="118" font-style="italic" font-weight="700" letter-spacing="18" fill="${template.ink}">${escapeXml(data.spouseOne.toUpperCase())}</text>
<line x1="387" y1="706" x2="475" y2="706" stroke="${template.soft}" stroke-width="3"/>
<text x="620" y="718" text-anchor="middle" font-family="Georgia, serif" font-size="54" font-style="italic" fill="${template.ink}">&amp;</text>
<line x1="760" y1="706" x2="846" y2="706" stroke="${template.soft}" stroke-width="3"/>
<text x="620" y="880" text-anchor="middle" font-family="Georgia, serif" font-size="118" font-style="italic" font-weight="700" letter-spacing="18" fill="${template.ink}">${escapeXml(data.spouseTwo.toUpperCase())}</text>
<text x="620" y="994" text-anchor="middle" font-family="Georgia, serif" font-size="46" font-style="italic" font-weight="700" fill="#404040">${escapeXml(month)}</text>
<text x="620" y="1120" text-anchor="middle" font-family="Georgia, serif" font-size="138" font-style="italic" font-weight="700" fill="${template.soft}">${escapeXml(day)}</text>
<text x="620" y="1196" text-anchor="middle" font-family="Georgia, serif" font-size="45" font-style="italic" fill="#404040">${escapeXml(year)}</text>
<line x1="286" y1="1028" x2="503" y2="1028" stroke="${template.ink}" stroke-width="3"/>
<line x1="286" y1="1134" x2="503" y2="1134" stroke="${template.ink}" stroke-width="3"/>
<text x="395" y="1092" text-anchor="middle" font-family="Georgia, serif" font-size="38" font-style="italic" font-weight="700" fill="#404040">${escapeXml(dayName)}</text>
<line x1="729" y1="1028" x2="958" y2="1028" stroke="${template.ink}" stroke-width="3"/>
<line x1="729" y1="1134" x2="958" y2="1134" stroke="${template.ink}" stroke-width="3"/>
<text x="844" y="1092" text-anchor="middle" font-family="Georgia, serif" font-size="38" font-style="italic" font-weight="700" fill="#404040">${escapeXml(hour)}</text>
<text x="620" y="1296" text-anchor="middle" font-family="Arial, sans-serif" font-size="31" font-weight="900" fill="${template.ink}">${escapeXml(data.zone.toUpperCase())}</text>
<text x="620" y="1358" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-size="44" font-weight="700" fill="${template.ink}">${escapeXml(data.address)}</text>
<g>
<rect x="935" y="1186" width="180" height="180" rx="18" fill="#ffffff" opacity="0.94" stroke="${template.soft}" stroke-width="3"/>
<image href="${qrUrl}" x="955" y="1206" width="140" height="140" preserveAspectRatio="xMidYMid meet"/>
<text x="1025" y="1392" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="${template.ink}">QR-${qrRecord.qr_id}</text>
</g>
</svg>`;
};

const renderCompactTicket = ({ template, qrUrl, event, qrRecord, cardMessage }) => {
    const title = escapeXml(event.title);
    const holder = escapeXml(qrRecord.holder_name);
    const date = escapeXml(getEventDate(event));
    const message = getCardMessage(cardMessage, template.cardMessageDefault || "Ticket compact à présenter");
    const primaryPanel = renderPrimaryImage({
        template,
        clipId: "compact-primary-zone",
        clipContent: `<rect x="36" y="36" width="280" height="${template.height - 72}" rx="26"/>`,
        x: 36,
        y: 36,
        width: 280,
        height: template.height - 72
    }) || `<rect x="36" y="36" width="280" height="${template.height - 72}" rx="26" fill="${template.accent}"/>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
<rect width="${template.width}" height="${template.height}" rx="30" fill="${template.surface}"/>
<rect x="36" y="36" width="${template.width - 72}" height="${template.height - 72}" rx="26" fill="#ffffff" stroke="#dbe3ea" stroke-width="3"/>
${primaryPanel}
<text x="82" y="152" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#ffffff">${template.label}</text>
<text x="82" y="202" font-family="Arial, sans-serif" font-size="19" fill="#ffffff" opacity="0.82">AccessQ</text>
${renderLogo(template, 82, 250, 58)}
<text x="370" y="132" font-family="Arial, sans-serif" font-size="40" font-weight="900" fill="${template.ink}">${fieldText(template, "event", title)}</text>
<text x="370" y="198" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#334155">${fieldText(template, "holder", holder)}</text>
<text x="370" y="258" font-family="Arial, sans-serif" font-size="23" fill="#64748b">${fieldText(template, "date", date)}</text>
<text x="370" y="326" font-family="Arial, sans-serif" font-size="20" fill="${template.accent}" font-weight="800">${fieldText(template, "message", message)}</text>
${isFieldVisible(template, "qr") ? `<rect x="915" y="96" width="260" height="260" rx="28" fill="#ffffff" stroke="#dbe3ea" stroke-width="4"/>
<image href="${qrUrl}" x="945" y="126" width="200" height="200"/>
<text x="915" y="412" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#475569">QR-${qrRecord.qr_id}</text>` : ""}
</svg>`;
};

const renderCard = (templateId, payload) => {
    const template = buildTemplate(templateId, payload.customization);
    if (template.canvasScene?.objects?.length) return renderCanvasScene({ template, ...payload });
    if (template.layoutConfig?.elements?.length) return renderLayoutCard({ template, ...payload });
    if (templateId === "wedding-modern-navy-beige") return renderModernNavyWeddingInvite({ template, ...payload });
    if (templateId === "compact-ticket") return renderCompactTicket({ template, ...payload });
    if (["event-ticket", "access-pass", "staff-badge-horizontal", "vip-pass"].includes(templateId)) return renderHorizontalTicket({ template, ...payload });
    if (["wedding-invite", "vip-invitation", "simple-invitation"].includes(templateId)) return renderWeddingInvite({ template, ...payload });
    return renderVerticalCard({ template, ...payload });
};

const localImagePathForHref = (href) => {
    const cleanHref = String(href || "").split("?")[0].trim();
    if (!cleanHref || cleanHref.startsWith("data:") || /^https?:\/\//i.test(cleanHref)) {
        return cleanHref;
    }

    const normalizedHref = cleanHref.startsWith("/") ? cleanHref.slice(1) : cleanHref;
    return storageService.findPublicAsset(...normalizedHref.split("/")) || cleanHref;
};

const writeSvgPdf = async ({ svg, pdfPath, width, height }) => {
    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: [width, height],
            margin: 0,
            autoFirstPage: true
        });
        const stream = fs.createWriteStream(pdfPath);

        stream.on("finish", resolve);
        stream.on("error", reject);
        doc.on("error", reject);
        doc.pipe(stream);

        SVGtoPDF(doc, svg, 0, 0, {
            width,
            height,
            assumePt: true,
            preserveAspectRatio: "xMidYMid meet",
            imageCallback: localImagePathForHref,
            warningCallback: () => {}
        });

        doc.end();
    });
};

exports.hasTemplate = hasTemplate;
exports.isTemplateAvailable = isTemplateAvailable;
exports.getTemplate = getTemplate;
exports.extractCustomTemplateId = extractCustomTemplateId;
exports.standardTemplates = templates;
exports.cardUrlForToken = cardUrlForToken;
exports.cardPdfUrlForToken = cardPdfUrlForToken;
exports.cardPathForToken = cardPathForToken;
exports.cardPdfPathForToken = cardPdfPathForToken;

exports.cardExistsForToken = (token) => fs.existsSync(cardPathForToken(token));

exports.cardPdfExistsForToken = (token) => fs.existsSync(cardPdfPathForToken(token));

exports.renderPreview = ({ templateId, customization }) => renderCard(templateId, {
    event: {
        title: "Nom de l’événement",
        EventSchedules: [{ start_date: "2026-07-12T18:00:00.000Z", area: { area_name: "Salle principale" } }]
    },
    qrRecord: { qr_id: 1, holder_name: "Marie Kabongo", level: 1, card_data: {} },
    qrUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='white'/%3E%3Cpath d='M10 10h60v60H10zM130 10h60v60h-60zM10 130h60v60H10zM90 90h20v20H90zM130 100h50v20h-50zM100 140h20v50h-20zM140 140h50v50h-50z' fill='black'/%3E%3C/svg%3E",
    cardMessage: customization?.cardMessageDefault || "Présentez ce QR à l’entrée",
    cardData: {},
    customization
});

exports.generateCardForQr = async ({ templateId, event, qrRecord, qrUrl, cardMessage, cardData, customization }) => {
    const baseTemplateId = customization?.baseTemplateId || templateId;
    const renderCustomization = customization?.baseTemplateId ? customization.customization : customization;

    if (!hasTemplate(baseTemplateId)) {
        throw new Error("Modèle de carte invalide.");
    }

    const cardPath = cardPathForToken(qrRecord.unique_token);
    const pdfPath = cardPdfPathForToken(qrRecord.unique_token);
    const dir = path.dirname(cardPath);
    await storageService.ensureDirectory(dir);

    const template = buildTemplate(baseTemplateId, renderCustomization);
    const width = Number(template.canvasScene?.canvas?.width || template.width);
    const height = Number(template.canvasScene?.canvas?.height || template.height);
    const svg = renderCard(baseTemplateId, { event, qrRecord, qrUrl, cardMessage, cardData, customization: renderCustomization });
    const suffix = `${process.pid}.${Date.now()}.tmp`;
    const temporaryCardPath = `${cardPath}.${suffix}`;
    const temporaryPdfPath = `${pdfPath}.${suffix}`;
    try {
        await fs.promises.writeFile(temporaryCardPath, svg, "utf8");
        await writeSvgPdf({ svg, pdfPath: temporaryPdfPath, width, height });
        await fs.promises.rename(temporaryCardPath, cardPath);
        await fs.promises.rename(temporaryPdfPath, pdfPath);
    } catch (error) {
        await Promise.allSettled([
            storageService.removeFile(temporaryCardPath),
            storageService.removeFile(temporaryPdfPath)
        ]);
        throw error;
    }
    return cardUrlForToken(qrRecord.unique_token);
};
