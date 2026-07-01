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
