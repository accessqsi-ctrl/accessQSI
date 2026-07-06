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

const withLayerDefaults = (elements) => elements.map((element, index) => ({
    zIndex: index + 1,
    locked: false,
    opacity: 1,
    ...element
}));

export const createDefaultLayoutConfig = (baseTemplateId = "event-ticket") => {
    const base = getBaseCardTemplate(baseTemplateId);
    const wide = base.layout === "wide" || base.layout === "compact";
    const badge = base.layout === "badge";

    if (wide) {
        return {
            version: 2,
            backgroundOpacity: 0.72,
            elements: withLayerDefaults([
                { type: "logo", label: "Logo", x: 80, y: 80, width: 86, height: 86, fontSize: 24, fontWeight: "700", color: "#ffffff", align: "left", visible: true, locked: false, opacity: 1 },
                { type: "title", label: "Titre", x: 90, y: 215, width: 330, height: 70, fontSize: 48, fontWeight: "900", color: "#ffffff", align: "left", visible: true, locked: false, opacity: 1 },
                { type: "event", label: "Événement", x: 540, y: 118, width: 650, height: 72, fontSize: 52, fontWeight: "900", color: "#0f172a", align: "left", visible: true, locked: false, opacity: 1 },
                { type: "holder", label: "Titulaire", x: 540, y: 230, width: 520, height: 46, fontSize: 34, fontWeight: "700", color: "#334155", align: "left", visible: true, locked: false, opacity: 1 },
                { type: "date", label: "Date", x: 540, y: 332, width: 420, height: 34, fontSize: 24, fontWeight: "700", color: "#334155", align: "left", visible: true, locked: false, opacity: 1 },
                { type: "location", label: "Lieu", x: 540, y: 390, width: 420, height: 32, fontSize: 22, fontWeight: "500", color: "#475569", align: "left", visible: true, locked: false, opacity: 1 },
                { type: "level", label: "Niveau", x: 540, y: 486, width: 240, height: 32, fontSize: 22, fontWeight: "800", color: "#2563eb", align: "left", visible: true, locked: false, opacity: 1 },
                { type: "message", label: "Message", x: 540, y: 532, width: 520, height: 30, fontSize: 19, fontWeight: "500", color: "#64748b", align: "left", visible: true, locked: false, opacity: 1 },
                { type: "qr", label: "QR", x: 1268, y: 126, width: 238, height: 238, fontSize: 20, fontWeight: "700", color: "#475569", align: "left", visible: true, locked: false, opacity: 1 },
                { type: "cardId", label: "ID carte", x: 1268, y: 422, width: 220, height: 30, fontSize: 21, fontWeight: "700", color: "#475569", align: "left", visible: true, locked: false, opacity: 1 }
            ])
        };
    }

    return {
        version: 2,
        backgroundOpacity: 0.72,
        elements: withLayerDefaults([
            { type: "logo", label: "Logo", x: badge ? 78 : 130, y: badge ? 78 : 128, width: 72, height: 72, fontSize: 22, fontWeight: "700", color: "#ffffff", align: "left", visible: true, locked: false, opacity: 1 },
            { type: "title", label: "Titre", x: 180, y: badge ? 150 : 230, width: badge ? 540 : 840, height: 52, fontSize: badge ? 24 : 38, fontWeight: "800", color: badge ? "#ffffff" : "#e11d48", align: "center", visible: true, locked: false, opacity: 1 },
            { type: "event", label: "Événement", x: badge ? 110 : 150, y: badge ? 740 : 360, width: badge ? 680 : 900, height: 82, fontSize: badge ? 30 : 68, fontWeight: "800", color: "#0f172a", align: "center", visible: true, locked: false, opacity: 1 },
            { type: "holder", label: "Titulaire", x: badge ? 110 : 180, y: badge ? 595 : 590, width: badge ? 680 : 840, height: 66, fontSize: badge ? 52 : 54, fontWeight: "900", color: "#0f172a", align: "center", visible: true, locked: false, opacity: 1 },
            { type: "date", label: "Date", x: badge ? 170 : 240, y: badge ? 805 : 775, width: badge ? 560 : 720, height: 44, fontSize: 30, fontWeight: "700", color: "#334155", align: "center", visible: true, locked: false, opacity: 1 },
            { type: "location", label: "Lieu", x: badge ? 170 : 240, y: badge ? 850 : 830, width: badge ? 560 : 720, height: 36, fontSize: 24, fontWeight: "500", color: "#64748b", align: "center", visible: true, locked: false, opacity: 1 },
            { type: "level", label: "Niveau", x: badge ? 250 : 260, y: badge ? 675 : 910, width: badge ? 400 : 680, height: 40, fontSize: 28, fontWeight: "800", color: "#2563eb", align: "center", visible: true, locked: false, opacity: 1 },
            { type: "message", label: "Message", x: badge ? 120 : 180, y: badge ? 1360 : 1460, width: badge ? 660 : 840, height: 34, fontSize: badge ? 20 : 24, fontWeight: "700", color: "#64748b", align: "center", visible: true, locked: false, opacity: 1 },
            { type: "qr", label: "QR", x: badge ? 250 : 420, y: badge ? 910 : 1010, width: badge ? 400 : 360, height: badge ? 400 : 360, fontSize: 20, fontWeight: "700", color: "#475569", align: "center", visible: true, locked: false, opacity: 1 },
            { type: "cardId", label: "ID carte", x: badge ? 250 : 420, y: badge ? 1328 : 1530, width: badge ? 400 : 360, height: 34, fontSize: 21, fontWeight: "700", color: "#475569", align: "center", visible: true, locked: false, opacity: 1 }
        ])
    };
};

const createCanvasObject = (object) => ({
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    stroke: "#cbd5e1",
    strokeWidth: 0,
    fontFamily: "Arial",
    fontWeight: "700",
    align: "left",
    cornerRadius: 0,
    ...object
});

export const createDefaultCanvasScene = (baseTemplateId = "event-ticket") => {
    const base = getBaseCardTemplate(baseTemplateId);
    const wide = base.layout === "wide" || base.layout === "compact";
    const badge = base.layout === "badge";
    const width = wide ? (base.layout === "compact" ? 1200 : 1600) : badge ? 900 : 1200;
    const height = wide ? (base.layout === "compact" ? 520 : 600) : badge ? 1400 : 1800;
    const accent = base.accent === "amber" ? "#d97706" : base.accent === "emerald" ? "#059669" : base.accent === "rose" ? "#e11d48" : base.accent === "violet" ? "#7c3aed" : base.accent === "teal" ? "#0f766e" : base.accent === "slate" ? "#334155" : "#2563eb";
    const soft = base.accent === "amber" ? "#fef3c7" : base.accent === "emerald" ? "#d1fae5" : base.accent === "rose" ? "#ffe4e6" : base.accent === "violet" ? "#ede9fe" : base.accent === "teal" ? "#ccfbf1" : base.accent === "slate" ? "#e2e8f0" : "#dbeafe";

    if (wide) {
        return {
            version: 3,
            canvas: { width, height, backgroundColor: "#f8fafc" },
            objects: [
                createCanvasObject({ id: "panel-accent", type: "rect", label: "Bande couleur", x: 40, y: 40, width: 420, height: height - 80, fill: accent, cornerRadius: 28, zIndex: 1 }),
                createCanvasObject({ id: "panel-main", type: "rect", label: "Fond contenu", x: 460, y: 40, width: width - 500, height: height - 80, fill: "#ffffff", stroke: soft, strokeWidth: 4, cornerRadius: 28, zIndex: 2 }),
                createCanvasObject({ id: "brand", type: "text", label: "Marque", text: "QR Access", x: 92, y: 118, width: 280, height: 34, fontSize: 25, fill: "#ffffff", opacity: 0.82, zIndex: 3 }),
                createCanvasObject({ id: "title", type: "text", label: "Titre", field: "title", text: "{{title}}", x: 92, y: 220, width: 310, height: 70, fontSize: 50, fontWeight: "900", fill: "#ffffff", zIndex: 4 }),
                createCanvasObject({ id: "event", type: "text", label: "Événement", field: "event", text: "{{event}}", x: 540, y: 130, width: 610, height: 70, fontSize: 54, fontWeight: "900", fill: "#0f172a", zIndex: 5 }),
                createCanvasObject({ id: "holder", type: "text", label: "Titulaire", field: "holder", text: "{{holder}}", x: 540, y: 242, width: 520, height: 48, fontSize: 34, fill: "#334155", zIndex: 6 }),
                createCanvasObject({ id: "date", type: "text", label: "Date", field: "date", text: "{{date}}", x: 540, y: 354, width: 440, height: 34, fontSize: 24, fill: "#334155", zIndex: 7 }),
                createCanvasObject({ id: "location", type: "text", label: "Lieu", field: "location", text: "{{location}}", x: 540, y: 410, width: 440, height: 32, fontSize: 22, fontWeight: "500", fill: "#475569", zIndex: 8 }),
                createCanvasObject({ id: "level", type: "text", label: "Niveau", field: "level", text: "{{level}}", x: 540, y: 492, width: 260, height: 32, fontSize: 22, fontWeight: "800", fill: accent, zIndex: 9 }),
                createCanvasObject({ id: "message", type: "text", label: "Message", field: "message", text: "{{message}}", x: 540, y: 536, width: 540, height: 30, fontSize: 19, fontWeight: "500", fill: "#64748b", zIndex: 10 }),
                createCanvasObject({ id: "qr", type: "qr", label: "QR", x: width - 332, y: 126, width: 238, height: 238, stroke: soft, strokeWidth: 5, cornerRadius: 24, zIndex: 11 }),
                createCanvasObject({ id: "card-id", type: "text", label: "ID carte", field: "cardId", text: "{{cardId}}", x: width - 332, y: 420, width: 230, height: 30, fontSize: 21, fill: "#475569", zIndex: 12 })
            ]
        };
    }

    return {
        version: 3,
        canvas: { width, height, backgroundColor: "#ffffff" },
        objects: [
            createCanvasObject({ id: "border", type: "rect", label: "Cadre", x: 54, y: 54, width: width - 108, height: height - 108, fill: "#ffffff", stroke: soft, strokeWidth: 8, cornerRadius: 52, zIndex: 1 }),
            createCanvasObject({ id: "title", type: "text", label: "Titre", field: "title", text: "{{title}}", x: 120, y: badge ? 154 : 230, width: width - 240, height: 58, fontSize: badge ? 32 : 40, fontWeight: "800", fill: accent, align: "center", zIndex: 2 }),
            createCanvasObject({ id: "holder", type: "text", label: "Titulaire", field: "holder", text: "{{holder}}", x: 120, y: badge ? 590 : 590, width: width - 240, height: 72, fontSize: badge ? 52 : 54, fontWeight: "900", fill: "#0f172a", align: "center", zIndex: 3 }),
            createCanvasObject({ id: "event", type: "text", label: "Événement", field: "event", text: "{{event}}", x: 120, y: badge ? 750 : 380, width: width - 240, height: 76, fontSize: badge ? 30 : 68, fontWeight: "800", fill: "#0f172a", align: "center", zIndex: 4 }),
            createCanvasObject({ id: "date", type: "text", label: "Date", field: "date", text: "{{date}}", x: 170, y: badge ? 820 : 780, width: width - 340, height: 44, fontSize: 30, fill: "#334155", align: "center", zIndex: 5 }),
            createCanvasObject({ id: "location", type: "text", label: "Lieu", field: "location", text: "{{location}}", x: 170, y: badge ? 870 : 838, width: width - 340, height: 36, fontSize: 24, fontWeight: "500", fill: "#64748b", align: "center", zIndex: 6 }),
            createCanvasObject({ id: "level", type: "text", label: "Niveau", field: "level", text: "{{level}}", x: 220, y: badge ? 680 : 920, width: width - 440, height: 40, fontSize: 28, fontWeight: "800", fill: accent, align: "center", zIndex: 7 }),
            createCanvasObject({ id: "qr", type: "qr", label: "QR", x: Math.round((width - (badge ? 400 : 360)) / 2), y: badge ? 930 : 1040, width: badge ? 400 : 360, height: badge ? 400 : 360, stroke: soft, strokeWidth: 7, cornerRadius: 36, zIndex: 8 }),
            createCanvasObject({ id: "message", type: "text", label: "Message", field: "message", text: "{{message}}", x: 130, y: badge ? 1355 : 1470, width: width - 260, height: 36, fontSize: badge ? 20 : 24, fill: "#64748b", align: "center", zIndex: 9 }),
            createCanvasObject({ id: "card-id", type: "text", label: "ID carte", field: "cardId", text: "{{cardId}}", x: 240, y: badge ? 1320 : 1535, width: width - 480, height: 34, fontSize: 21, fill: "#475569", align: "center", zIndex: 10 })
        ]
    };
};

export const normalizeCustomCardTemplate = (template) => {
    const baseTemplate = getBaseCardTemplate(template.baseTemplateId);
    const layoutConfig = template.layoutConfig
        ? {
            version: 2,
            backgroundOpacity: template.layoutConfig.backgroundOpacity ?? 0.72,
            elements: withLayerDefaults(template.layoutConfig.elements || [])
        }
        : null;

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
        layoutConfig,
        layout: template.layout || baseTemplate.layout,
        format: baseTemplate.format,
        description: `Variante de ${baseTemplate.name}`,
        canvasScene: template.canvasScene || createDefaultCanvasScene(template.baseTemplateId),
        fields: Object.entries({ ...defaultVisibleFields, ...(template.visibleFields || {}) })
            .filter(([, visible]) => visible)
            .map(([field]) => field)
    };
};
