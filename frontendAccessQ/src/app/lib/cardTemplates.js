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
    }
];

export const CARD_TEMPLATE_STORAGE_KEY = "qrAccessCardTemplateId";
