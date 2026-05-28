const prisma = require("../prisma/client");

// Récupérer tous les QR Codes pour un événement spécifique (filtré par organisation)
exports.getQrsByEventId = async (orgId, eventId) => {
    return await prisma.qrCode.findMany({
        where: {
            event_id: eventId,
            event: { org_id: orgId },
            deleted_at: null
        },
        include: {
            event: { select: { title: true } }
        },
        orderBy: { qr_id: 'desc' }
    });
};

// Récupérer tous les QR Codes des événements de l'organisation
exports.getAllQrsForOrg = async (orgId) => {
    return await prisma.qrCode.findMany({
        where: {
            event: {
                org_id: orgId
            },
            deleted_at: null
        },
        include: {
            event: {
                select: { title: true }
            }
        },
        orderBy: {
            qr_id: 'desc'
        }
    });
};

// Rechercher un QR Code spécifique
exports.getQrById = async (id) => {
    return await prisma.qrCode.findUnique({
        where: { qr_id: id },
    });
};

// Créer un nouveau QR Code
exports.createQr = async (data) => {
    return await prisma.qrCode.create({
        data,
    });
};

// Mettre à jour un QR Code existant
exports.updateQr = async (id, data) => {
    return await prisma.qrCode.update({
        where: { qr_id: id },
        data,
    });
};

// Suppression logique d'un QR Code
exports.deleteQr = async (id) => {
    return await prisma.qrCode.update({
        where: { qr_id: id },
        data: { deleted_at: new Date() }
    });
};
