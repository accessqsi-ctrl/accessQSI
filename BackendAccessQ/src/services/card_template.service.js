const fs = require("fs");
const path = require("path");

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

const getCardMessage = (message, fallback = "Présentez ce QR à l'entrée") => {
    const trimmed = String(message || "").trim();
    return escapeXml(trimmed || fallback);
};

const cardFilenameForToken = (token) => `card_${token}.svg`;

const cardPathForToken = (token) => path.join(__dirname, "../statics/cards", cardFilenameForToken(token));

const cardUrlForToken = (token) => `/cards/${cardFilenameForToken(token)}`;

const hasTemplate = (templateId) => Boolean(templates[templateId]);

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
        accent: customization.primaryColor || template.accent,
        soft: customization.secondaryColor || template.soft,
        label: customization.title || template.label,
        logoUrl: customization.logoUrl || "",
        backgroundImageUrl: customization.backgroundImageUrl || "",
        qrPosition: customization.qrPosition || "right",
        visibleFields: customization.visibleFields || {},
        layoutConfig: customization.layoutConfig || null,
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

const renderLayoutCard = ({ template, qrUrl, event, qrRecord, cardMessage }) => {
    const elements = Array.isArray(template.layoutConfig?.elements) ? template.layoutConfig.elements : [];
    const backgroundOpacity = template.layoutConfig?.backgroundOpacity ?? 0.72;
    const background = template.backgroundImageUrl
        ? `<image href="${escapeXml(template.backgroundImageUrl)}" x="0" y="0" width="${template.width}" height="${template.height}" preserveAspectRatio="xMidYMid slice" opacity="${backgroundOpacity}"/>
<rect width="${template.width}" height="${template.height}" rx="34" fill="#ffffff" opacity="${Math.max(0, 1 - backgroundOpacity) * 0.7}"/>`
        : `<rect width="${template.width}" height="${template.height}" rx="34" fill="${template.surface}"/>
<rect x="40" y="40" width="${template.width - 80}" height="${template.height - 80}" rx="28" fill="#ffffff" stroke="${template.soft}" stroke-width="4"/>`;

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

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
<rect width="${template.width}" height="${template.height}" rx="34" fill="${template.surface}"/>
<rect x="40" y="40" width="${template.width - 80}" height="${template.height - 80}" rx="28" fill="#ffffff" stroke="#dbe3ea" stroke-width="3"/>
<rect x="40" y="40" width="420" height="${template.height - 80}" rx="28" fill="${template.accent}"/>
<path d="M432 40 h28 v${template.height - 80} h-28 a28 28 0 0 0 28 -28 v-${template.height - 136} a28 28 0 0 0 -28 -28z" fill="${template.accent}"/>
<circle cx="134" cy="134" r="72" fill="#ffffff" opacity="0.14"/>
<circle cx="400" cy="${template.height - 118}" r="118" fill="#ffffff" opacity="0.10"/>
<text x="92" y="182" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#ffffff" opacity="0.82">QR Access</text>
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

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
<rect width="${template.width}" height="${template.height}" rx="64" fill="${template.surface}"/>
<rect x="54" y="54" width="${template.width - 108}" height="${template.height - 108}" rx="52" fill="#ffffff" stroke="#dbe3ea" stroke-width="4"/>
<rect x="54" y="54" width="${template.width - 108}" height="360" rx="52" fill="${template.accent}"/>
<rect x="54" y="330" width="${template.width - 108}" height="120" fill="${template.accent}"/>
<text x="450" y="154" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="800" fill="#ffffff">QR Access</text>
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

const renderCompactTicket = ({ template, qrUrl, event, qrRecord, cardMessage }) => {
    const title = escapeXml(event.title);
    const holder = escapeXml(qrRecord.holder_name);
    const date = escapeXml(getEventDate(event));
    const message = getCardMessage(cardMessage, template.cardMessageDefault || "Ticket compact à présenter");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
<rect width="${template.width}" height="${template.height}" rx="30" fill="${template.surface}"/>
<rect x="36" y="36" width="${template.width - 72}" height="${template.height - 72}" rx="26" fill="#ffffff" stroke="#dbe3ea" stroke-width="3"/>
<rect x="36" y="36" width="280" height="${template.height - 72}" rx="26" fill="${template.accent}"/>
<text x="82" y="152" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#ffffff">${template.label}</text>
<text x="82" y="202" font-family="Arial, sans-serif" font-size="19" fill="#ffffff" opacity="0.82">QR Access</text>
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
    if (template.layoutConfig?.elements?.length) return renderLayoutCard({ template, ...payload });
    if (templateId === "compact-ticket") return renderCompactTicket({ template, ...payload });
    if (["event-ticket", "access-pass", "staff-badge-horizontal", "vip-pass"].includes(templateId)) return renderHorizontalTicket({ template, ...payload });
    if (["wedding-invite", "vip-invitation", "simple-invitation"].includes(templateId)) return renderWeddingInvite({ template, ...payload });
    return renderVerticalCard({ template, ...payload });
};

exports.hasTemplate = hasTemplate;
exports.getTemplate = getTemplate;
exports.extractCustomTemplateId = extractCustomTemplateId;
exports.standardTemplates = templates;
exports.cardUrlForToken = cardUrlForToken;
exports.cardPathForToken = cardPathForToken;

exports.cardExistsForToken = (token) => fs.existsSync(cardPathForToken(token));

exports.generateCardForQr = async ({ templateId, event, qrRecord, qrUrl, cardMessage, customization }) => {
    const baseTemplateId = customization?.baseTemplateId || templateId;
    const renderCustomization = customization?.baseTemplateId ? customization.customization : customization;

    if (!hasTemplate(baseTemplateId)) {
        throw new Error("Modèle de carte invalide.");
    }

    const cardPath = cardPathForToken(qrRecord.unique_token);
    const dir = path.dirname(cardPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const svg = renderCard(baseTemplateId, { event, qrRecord, qrUrl, cardMessage, customization: renderCustomization });
    await fs.promises.writeFile(cardPath, svg, "utf8");
    return cardUrlForToken(qrRecord.unique_token);
};
