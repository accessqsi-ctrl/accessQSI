const prisma = require("../prisma/client");

const normalizePagination = ({ page = 1, pageSize = 25 } = {}) => {
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safePageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 25));
    return { page: safePage, pageSize: safePageSize };
};

const statusFilter = (status, now = new Date()) => {
    if (status === "revoked") return { status: "revoked" };
    if (status === "used_up") return { status: "used_up" };
    if (status === "expired") {
        return {
            OR: [
                { status: "expired" },
                { status: "active", valid_until: { lt: now } }
            ]
        };
    }
    if (status === "active") {
        return {
            status: "active",
            OR: [
                { valid_until: null },
                { valid_until: { gte: now } }
            ]
        };
    }
    return {};
};

const searchFilter = (search) => {
    const term = String(search || "").trim();
    if (!term) return {};
    const id = Number(term);
    return {
        OR: [
            ...(Number.isInteger(id) ? [{ qr_id: id }] : []),
            { holder_name: { contains: term, mode: "insensitive" } },
            { holder_email: { contains: term, mode: "insensitive" } },
            { unique_token: { contains: term, mode: "insensitive" } }
        ]
    };
};

// Récupérer tous les QR Codes pour un événement spécifique (filtré par organisation)
exports.getQrsByEventId = async (orgId, eventId, options = {}) => {
    const { page, pageSize } = normalizePagination(options);
    const where = {
        event_id: eventId,
        event: { org_id: orgId },
        deleted_at: null,
        AND: [
            statusFilter(options.status),
            searchFilter(options.search)
        ]
    };
    const [items, total] = await prisma.$transaction([
        prisma.qrCode.findMany({
            where,
            include: { event: { select: { title: true } } },
            orderBy: { qr_id: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize
        }),
        prisma.qrCode.count({ where })
    ]);
    return {
        items,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize))
        }
    };
};

// Utilisé pour produire un document PDF complet sans dépendre de la pagination UI.
exports.getAllQrsByEventId = async (orgId, eventId, { take = 200, skip = 0 } = {}) => {
    const safeTake = Math.min(200, Math.max(1, Number.parseInt(take, 10) || 200));
    const safeSkip = Math.max(0, Number.parseInt(skip, 10) || 0);
    return prisma.qrCode.findMany({
        where: {
            event_id: eventId,
            event: { org_id: orgId },
            deleted_at: null
        },
        orderBy: { qr_id: "asc" },
        skip: safeSkip,
        take: safeTake
    });
};

exports.countQrsByEventId = async (orgId, eventId) => prisma.qrCode.count({
    where: { event_id: eventId, event: { org_id: orgId }, deleted_at: null }
});

// Récupérer tous les QR Codes des événements de l'organisation
exports.getAllQrsForOrg = async (orgId, options = {}) => {
    const { page, pageSize } = normalizePagination(options);
    const where = {
        event: { org_id: orgId },
        deleted_at: null,
        AND: [
            statusFilter(options.status),
            searchFilter(options.search)
        ]
    };
    const [items, total] = await prisma.$transaction([
        prisma.qrCode.findMany({
            where,
            include: { event: { select: { title: true } } },
            orderBy: { qr_id: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize
        }),
        prisma.qrCode.count({ where })
    ]);
    return {
        items,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize))
        }
    };
};

// Rechercher un QR Code spécifique
exports.getQrById = async (id) => {
    return await prisma.qrCode.findUnique({
        where: { qr_id: id },
    });
};

// Créer un nouveau QR Code
exports.createQr = async (data, dbClient = prisma) => {
    return await dbClient.qrCode.create({
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

exports.deleteQrPermanently = async (id) => {
    return prisma.qrCode.delete({
        where: { qr_id: id }
    });
};
