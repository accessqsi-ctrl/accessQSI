const fs = require("fs");
const path = require("path");

const templates = {
    "event-ticket": {
        id: "event-ticket",
        width: 1600,
        height: 600,
        accent: "#2563eb",
        soft: "#dbeafe",
        label: "BILLET"
    },
    "staff-card": {
        id: "staff-card",
        width: 900,
        height: 1400,
        accent: "#059669",
        soft: "#d1fae5",
        label: "STAFF"
    },
    "wedding-invite": {
        id: "wedding-invite",
        width: 1200,
        height: 1800,
        accent: "#e11d48",
        soft: "#ffe4e6",
        label: "INVITATION"
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

const cardFilenameForToken = (token) => `card_${token}.svg`;

const cardPathForToken = (token) => path.join(__dirname, "../statics/cards", cardFilenameForToken(token));

const cardUrlForToken = (token) => `/cards/${cardFilenameForToken(token)}`;

const hasTemplate = (templateId) => Boolean(templates[templateId]);

const renderHorizontalTicket = ({ template, qrUrl, event, qrRecord }) => {
    const title = escapeXml(event.title);
    const holder = escapeXml(qrRecord.holder_name);
    const date = escapeXml(getEventDate(event));
    const location = escapeXml(getEventLocation(event));

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
<rect width="1600" height="600" fill="#f8fafc"/>
<rect x="0" y="0" width="510" height="600" fill="${template.accent}"/>
<circle cx="120" cy="110" r="78" fill="#ffffff" opacity="0.14"/>
<circle cx="450" cy="510" r="140" fill="#ffffff" opacity="0.10"/>
<text x="88" y="288" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#ffffff">${template.label}</text>
<text x="88" y="342" font-family="Arial, sans-serif" font-size="24" fill="#bfdbfe">QR Access</text>
<text x="600" y="128" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="${template.accent}">${template.label} NUMERIQUE</text>
<text x="600" y="220" font-family="Arial, sans-serif" font-size="58" font-weight="800" fill="#0f172a">${title}</text>
<text x="600" y="292" font-family="Arial, sans-serif" font-size="34" fill="#334155">${holder}</text>
<text x="600" y="374" font-family="Arial, sans-serif" font-size="26" fill="#64748b">${date}</text>
<text x="600" y="426" font-family="Arial, sans-serif" font-size="26" fill="#64748b">${location}</text>
<rect x="1248" y="134" width="250" height="250" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="4"/>
<image href="${qrUrl}" x="1272" y="158" width="202" height="202"/>
<text x="1248" y="438" font-family="Arial, sans-serif" font-size="22" fill="#64748b">QR-${qrRecord.qr_id}</text>
<line x1="1138" y1="60" x2="1138" y2="540" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="18 18"/>
</svg>`;
};

const renderVerticalCard = ({ template, qrUrl, event, qrRecord }) => {
    const title = escapeXml(event.title);
    const holder = escapeXml(qrRecord.holder_name);
    const location = escapeXml(getEventLocation(event));
    const level = escapeXml(qrRecord.level || 1);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
<rect width="${template.width}" height="${template.height}" rx="64" fill="#ffffff"/>
<rect x="0" y="0" width="${template.width}" height="390" rx="64" fill="${template.accent}"/>
<rect x="0" y="310" width="${template.width}" height="110" fill="${template.accent}"/>
<circle cx="450" cy="360" r="150" fill="#ffffff"/>
<circle cx="450" cy="360" r="124" fill="${template.soft}"/>
<text x="450" y="384" text-anchor="middle" font-family="Arial, sans-serif" font-size="78" font-weight="800" fill="${template.accent}">${holder.slice(0, 1).toUpperCase()}</text>
<text x="450" y="178" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">QR Access</text>
<text x="450" y="610" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="800" fill="#0f172a">${holder}</text>
<text x="450" y="678" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#64748b">${template.label} - Niveau ${level}</text>
<text x="450" y="762" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#334155">${title}</text>
<text x="450" y="816" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#64748b">${location}</text>
<rect x="275" y="900" width="350" height="350" rx="32" fill="#ffffff" stroke="#e2e8f0" stroke-width="5"/>
<image href="${qrUrl}" x="310" y="935" width="280" height="280"/>
<text x="450" y="1306" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#64748b">QR-${qrRecord.qr_id}</text>
</svg>`;
};

const renderWeddingInvite = ({ template, qrUrl, event, qrRecord }) => {
    const title = escapeXml(event.title);
    const holder = escapeXml(qrRecord.holder_name);
    const date = escapeXml(getEventDate(event));
    const location = escapeXml(getEventLocation(event));

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.width}" height="${template.height}" viewBox="0 0 ${template.width} ${template.height}">
<rect width="1200" height="1800" fill="#fff7f8"/>
<rect x="70" y="70" width="1060" height="1660" rx="54" fill="#ffffff" stroke="${template.soft}" stroke-width="8"/>
<circle cx="178" cy="196" r="76" fill="${template.soft}"/>
<circle cx="1026" cy="1602" r="118" fill="${template.soft}"/>
<text x="600" y="288" text-anchor="middle" font-family="Georgia, serif" font-size="38" font-style="italic" fill="${template.accent}">Invitation</text>
<text x="600" y="420" text-anchor="middle" font-family="Georgia, serif" font-size="74" font-weight="700" fill="#881337">${title}</text>
<text x="600" y="568" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#64748b">Invite</text>
<text x="600" y="636" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="#0f172a">${holder}</text>
<text x="600" y="780" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#334155">${date}</text>
<text x="600" y="842" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#64748b">${location}</text>
<rect x="425" y="1060" width="350" height="350" rx="32" fill="#ffffff" stroke="#fecdd3" stroke-width="5"/>
<image href="${qrUrl}" x="460" y="1095" width="280" height="280"/>
<text x="600" y="1512" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#9f1239">Presentez ce QR a l'entree</text>
</svg>`;
};

const renderCard = (templateId, payload) => {
    const template = templates[templateId];
    if (templateId === "event-ticket") return renderHorizontalTicket({ template, ...payload });
    if (templateId === "wedding-invite") return renderWeddingInvite({ template, ...payload });
    return renderVerticalCard({ template, ...payload });
};

exports.hasTemplate = hasTemplate;
exports.cardUrlForToken = cardUrlForToken;
exports.cardPathForToken = cardPathForToken;

exports.cardExistsForToken = (token) => fs.existsSync(cardPathForToken(token));

exports.generateCardForQr = async ({ templateId, event, qrRecord, qrUrl }) => {
    if (!hasTemplate(templateId)) {
        throw new Error("Modèle de carte invalide.");
    }

    const cardPath = cardPathForToken(qrRecord.unique_token);
    const dir = path.dirname(cardPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const svg = renderCard(templateId, { event, qrRecord, qrUrl });
    await fs.promises.writeFile(cardPath, svg, "utf8");
    return cardUrlForToken(qrRecord.unique_token);
};
