export const cardTemplates = [
    {
        id: "event-ticket",
        name: "Billet événement",
        category: "Billetterie",
        format: "1600 x 600 px",
        accent: "blue",
        description: "Support horizontal pour concerts, conférences et accès VIP.",
        fields: ["Nom", "Événement", "Date", "Zone", "QR"]
    },
    {
        id: "staff-card",
        name: "Carte du personnel",
        category: "Organisation",
        format: "900 x 1400 px",
        accent: "emerald",
        description: "Badge vertical avec identité, rôle et niveau d'accréditation.",
        fields: ["Nom", "Rôle", "Organisation", "Niveau", "QR"]
    },
    {
        id: "wedding-invite",
        name: "Invitation de mariage",
        category: "Cérémonie",
        format: "1200 x 1800 px",
        accent: "rose",
        description: "Invitation élégante avec QR de validation à l'entrée.",
        fields: ["Invité", "Couple", "Date", "Lieu", "QR"]
    }
];

export const CARD_TEMPLATE_STORAGE_KEY = "qrAccessCardTemplateId";
