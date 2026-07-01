export const cardTemplates = [
    {
        id: "event-ticket",
        name: "Billet événement",
        category: "Billetterie",
        format: "1600 x 600 px",
        accent: "blue",
        layout: "wide",
        description: "Support horizontal pour concerts, conférences et accès VIP.",
        fields: ["Nom", "Événement", "Date", "Zone", "QR"]
    },
    {
        id: "access-pass",
        name: "Pass d'accès",
        category: "Contrôle d'accès",
        format: "1600 x 600 px",
        accent: "amber",
        layout: "wide",
        description: "Pass lisible à l'entrée pour invités, exposants et accès temporaires.",
        fields: ["Nom", "Événement", "Niveau", "Validité", "QR"]
    },
    {
        id: "staff-card",
        name: "Carte du personnel",
        category: "Organisation",
        format: "900 x 1400 px",
        accent: "emerald",
        layout: "badge",
        description: "Badge vertical avec identité, rôle et niveau d'accréditation.",
        fields: ["Nom", "Rôle", "Organisation", "Niveau", "QR"]
    },
    {
        id: "staff-badge-horizontal",
        name: "Badge staff horizontal",
        category: "Organisation",
        format: "1600 x 600 px",
        accent: "teal",
        layout: "wide",
        description: "Badge horizontal compact pour équipes, sécurité et prestataires.",
        fields: ["Nom", "Rôle", "Niveau", "Zone", "QR"]
    },
    {
        id: "wedding-invite",
        name: "Invitation de mariage",
        category: "Cérémonie",
        format: "1200 x 1800 px",
        accent: "rose",
        layout: "invite",
        description: "Invitation élégante avec QR de validation à l'entrée.",
        fields: ["Invité", "Couple", "Date", "Lieu", "QR"]
    },
    {
        id: "vip-invitation",
        name: "Invitation VIP",
        category: "Invitation",
        format: "1200 x 1800 px",
        accent: "violet",
        layout: "invite",
        description: "Carton vertical pour invités officiels, partenaires et accès premium.",
        fields: ["Invité", "Événement", "Date", "Espace", "QR"]
    },
    {
        id: "vip-pass",
        name: "Pass VIP",
        category: "Premium",
        format: "1600 x 600 px",
        accent: "violet",
        layout: "wide",
        description: "Pass horizontal pour invités VIP, partenaires et accès premium.",
        fields: ["Invité", "Événement", "Niveau", "Message", "QR"]
    },
    {
        id: "simple-invitation",
        name: "Invitation simple",
        category: "Invitation",
        format: "1200 x 1800 px",
        accent: "slate",
        layout: "invite",
        description: "Invitation sobre pour cérémonies, réunions et accès nominatifs.",
        fields: ["Invité", "Événement", "Date", "Lieu", "QR"]
    },
    {
        id: "compact-ticket",
        name: "Ticket compact",
        category: "Billetterie",
        format: "1200 x 520 px",
        accent: "blue",
        layout: "compact",
        description: "Ticket court pour impression rapide ou partage mobile.",
        fields: ["Nom", "Événement", "Date", "QR"]
    }
];

export const CARD_TEMPLATE_STORAGE_KEY = "qrAccessCardTemplateId";

export const defaultVisibleFields = {
    holder: true,
    event: true,
    date: true,
    location: true,
    level: true,
    message: true,
    qr: true
};

export const getBaseCardTemplate = (templateId) => cardTemplates.find(template => template.id === templateId) || cardTemplates[0];

export const cardElementLabels = {
    logo: "Logo",
    title: "Titre",
    event: "Événement",
    holder: "Titulaire",
    date: "Date",
    location: "Lieu",
    level: "Niveau",
    message: "Message",
    qr: "QR",
    cardId: "ID carte"
};

export const createDefaultLayoutConfig = (baseTemplateId = "event-ticket") => {
    const base = getBaseCardTemplate(baseTemplateId);
    const wide = base.layout === "wide" || base.layout === "compact";
    const badge = base.layout === "badge";

    if (wide) {
        return {
            version: 2,
            elements: [
                { type: "logo", label: "Logo", x: 80, y: 80, width: 86, height: 86, fontSize: 24, fontWeight: "700", color: "#ffffff", align: "left", visible: true },
                { type: "title", label: "Titre", x: 90, y: 215, width: 330, height: 70, fontSize: 48, fontWeight: "900", color: "#ffffff", align: "left", visible: true },
                { type: "event", label: "Événement", x: 540, y: 118, width: 650, height: 72, fontSize: 52, fontWeight: "900", color: "#0f172a", align: "left", visible: true },
                { type: "holder", label: "Titulaire", x: 540, y: 230, width: 520, height: 46, fontSize: 34, fontWeight: "700", color: "#334155", align: "left", visible: true },
                { type: "date", label: "Date", x: 540, y: 332, width: 420, height: 34, fontSize: 24, fontWeight: "700", color: "#334155", align: "left", visible: true },
                { type: "location", label: "Lieu", x: 540, y: 390, width: 420, height: 32, fontSize: 22, fontWeight: "500", color: "#475569", align: "left", visible: true },
                { type: "level", label: "Niveau", x: 540, y: 486, width: 240, height: 32, fontSize: 22, fontWeight: "800", color: "#2563eb", align: "left", visible: true },
                { type: "message", label: "Message", x: 540, y: 532, width: 520, height: 30, fontSize: 19, fontWeight: "500", color: "#64748b", align: "left", visible: true },
                { type: "qr", label: "QR", x: 1268, y: 126, width: 238, height: 238, fontSize: 20, fontWeight: "700", color: "#475569", align: "left", visible: true },
                { type: "cardId", label: "ID carte", x: 1268, y: 422, width: 220, height: 30, fontSize: 21, fontWeight: "700", color: "#475569", align: "left", visible: true }
            ]
        };
    }

    return {
        version: 2,
        elements: [
            { type: "logo", label: "Logo", x: badge ? 78 : 130, y: badge ? 78 : 128, width: 72, height: 72, fontSize: 22, fontWeight: "700", color: "#ffffff", align: "left", visible: true },
            { type: "title", label: "Titre", x: 180, y: badge ? 150 : 230, width: badge ? 540 : 840, height: 52, fontSize: badge ? 24 : 38, fontWeight: "800", color: badge ? "#ffffff" : "#e11d48", align: "center", visible: true },
            { type: "event", label: "Événement", x: badge ? 110 : 150, y: badge ? 740 : 360, width: badge ? 680 : 900, height: 82, fontSize: badge ? 30 : 68, fontWeight: "800", color: "#0f172a", align: "center", visible: true },
            { type: "holder", label: "Titulaire", x: badge ? 110 : 180, y: badge ? 595 : 590, width: badge ? 680 : 840, height: 66, fontSize: badge ? 52 : 54, fontWeight: "900", color: "#0f172a", align: "center", visible: true },
            { type: "date", label: "Date", x: badge ? 170 : 240, y: badge ? 805 : 775, width: badge ? 560 : 720, height: 44, fontSize: 30, fontWeight: "700", color: "#334155", align: "center", visible: true },
            { type: "location", label: "Lieu", x: badge ? 170 : 240, y: badge ? 850 : 830, width: badge ? 560 : 720, height: 36, fontSize: 24, fontWeight: "500", color: "#64748b", align: "center", visible: true },
            { type: "level", label: "Niveau", x: badge ? 250 : 260, y: badge ? 675 : 910, width: badge ? 400 : 680, height: 40, fontSize: 28, fontWeight: "800", color: "#2563eb", align: "center", visible: true },
            { type: "message", label: "Message", x: badge ? 120 : 180, y: badge ? 1360 : 1460, width: badge ? 660 : 840, height: 34, fontSize: badge ? 20 : 24, fontWeight: "700", color: "#64748b", align: "center", visible: true },
            { type: "qr", label: "QR", x: badge ? 250 : 420, y: badge ? 910 : 1010, width: badge ? 400 : 360, height: badge ? 400 : 360, fontSize: 20, fontWeight: "700", color: "#475569", align: "center", visible: true },
            { type: "cardId", label: "ID carte", x: badge ? 250 : 420, y: badge ? 1328 : 1530, width: badge ? 400 : 360, height: 34, fontSize: 21, fontWeight: "700", color: "#475569", align: "center", visible: true }
        ]
    };
};

export const normalizeCustomCardTemplate = (template) => {
    const baseTemplate = getBaseCardTemplate(template.baseTemplateId);

    return {
        ...baseTemplate,
        id: template.templateId || `custom:${template.id}`,
        customId: template.id,
        baseTemplateId: template.baseTemplateId,
        name: template.name,
        category: "Personnalisé",
        accent: "custom",
        primaryColor: template.primaryColor,
        secondaryColor: template.secondaryColor,
        title: template.title,
        cardMessageDefault: template.cardMessageDefault || "",
        logoUrl: template.logoUrl || "",
        backgroundImageUrl: template.backgroundImageUrl || "",
        qrPosition: template.qrPosition || "right",
        visibleFields: { ...defaultVisibleFields, ...(template.visibleFields || {}) },
        layoutConfig: template.layoutConfig || null,
        layout: template.layout || baseTemplate.layout,
        format: baseTemplate.format,
        description: `Variante de ${baseTemplate.name}`,
        fields: Object.entries({ ...defaultVisibleFields, ...(template.visibleFields || {}) })
            .filter(([, visible]) => visible)
            .map(([field]) => field)
    };
};
