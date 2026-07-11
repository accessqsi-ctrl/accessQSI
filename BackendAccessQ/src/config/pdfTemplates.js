const pdfTemplates = {
    "badge-horizontal": {
        id: "badge-horizontal",
        name: "Badge horizontal",
        description: "Badge court pour visiteurs, agents ou accès temporaires.",
        filename: "badge-horizontal.pdf",
        fields: {
            modelName: {
                type: "text",
                label: "Nom du modèle",
                page: 0,
                x: 0.34,
                y: 0.58,
                width: 0.52,
                fontSizeRatio: 0.075,
                minFontSize: 8,
                align: "center",
                fontWeight: "bold",
                required: true
            },
            company: {
                type: "text",
                label: "Organisation",
                input: false,
                auto: "organizationName",
                page: 0,
                x: 0.34,
                y: 0.46,
                width: 0.52,
                fontSizeRatio: 0.04,
                minFontSize: 7,
                align: "center"
            },
            identifier: {
                type: "text",
                label: "Identifiant",
                input: false,
                auto: "identifier",
                page: 0,
                x: 0.34,
                y: 0.34,
                width: 0.52,
                fontSizeRatio: 0.033,
                minFontSize: 7,
                align: "center"
            },
            photo: {
                type: "image",
                page: 0,
                x: 0.08,
                y: 0.24,
                width: 0.2,
                height: 0.52,
                objectFit: "cover"
            }
        }
    },
    "invitation-event": {
        id: "invitation-event",
        name: "Invitation événement",
        description: "Invitation portrait pour conférences, cérémonies et événements privés.",
        filename: "invitation-event.pdf",
        fields: {
            modelName: {
                type: "text",
                label: "Nom du modèle",
                page: 0,
                x: 0.16,
                y: 0.53,
                width: 0.68,
                fontSizeRatio: 0.035,
                minFontSize: 10,
                align: "center",
                fontWeight: "bold",
                required: true
            },
            company: {
                type: "text",
                label: "Organisation",
                input: false,
                auto: "organizationName",
                page: 0,
                x: 0.18,
                y: 0.46,
                width: 0.64,
                fontSizeRatio: 0.022,
                minFontSize: 8,
                align: "center"
            },
            identifier: {
                type: "text",
                label: "Identifiant",
                input: false,
                auto: "identifier",
                page: 0,
                x: 0.18,
                y: 0.2,
                width: 0.64,
                fontSizeRatio: 0.018,
                minFontSize: 7,
                align: "center"
            }
        }
    },
    "access-card": {
        id: "access-card",
        name: "Carte d'accès",
        description: "Carte compacte pour collaborateurs, membres ou prestataires.",
        filename: "access-card.pdf",
        fields: {
            modelName: {
                type: "text",
                label: "Nom du modèle",
                page: 0,
                x: 0.14,
                y: 0.42,
                width: 0.72,
                fontSizeRatio: 0.052,
                minFontSize: 8,
                align: "center",
                fontWeight: "bold",
                required: true
            },
            company: {
                type: "text",
                label: "Organisation",
                input: false,
                auto: "organizationName",
                page: 0,
                x: 0.14,
                y: 0.32,
                width: 0.72,
                fontSizeRatio: 0.032,
                minFontSize: 7,
                align: "center"
            },
            identifier: {
                type: "text",
                label: "Identifiant",
                input: false,
                auto: "identifier",
                page: 0,
                x: 0.14,
                y: 0.18,
                width: 0.72,
                fontSizeRatio: 0.026,
                minFontSize: 7,
                align: "center"
            },
            photo: {
                type: "image",
                page: 0,
                x: 0.35,
                y: 0.56,
                width: 0.3,
                height: 0.24,
                objectFit: "cover"
            }
        }
    }
};

module.exports = pdfTemplates;
