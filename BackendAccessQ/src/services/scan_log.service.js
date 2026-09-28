const prisma = require("../prisma/client");

const SCAN_STATUSES = new Set([
    "authorized",
    "denied_expired",
    "denied_revoked",
    "denied_limit_reached",
    "denied_event_inactive",
    "denied_event_not_selected",
    "denied_area_not_allowed",
    "denied_insufficient_level"
]);

const boundedInteger = (value, fallback, min, max) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
};

const optionalPositiveInteger = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const optionalDate = (value, field) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        const error = new Error(`Le filtre ${field} est invalide.`);
        error.code = "INVALID_SCAN_FILTERS";
        throw error;
    }
    return parsed;
};

const buildWhere = (orgId, filters) => {
    const eventId = optionalPositiveInteger(filters.eventId);
    const areaId = optionalPositiveInteger(filters.areaId);
    const from = optionalDate(filters.from, "date de début");
    const to = optionalDate(filters.to, "date de fin");
    if (from && to && from > to) {
        const error = new Error("La date de début doit précéder la date de fin.");
        error.code = "INVALID_SCAN_FILTERS";
        throw error;
    }

    const where = {
        qr_code: {
            event: {
                org_id: orgId,
                ...(eventId ? { event_id: eventId } : {})
            }
        },
        scanned_by: { org_id: orgId }
    };

    if (areaId) where.area_id = areaId;
    if (from || to) {
        where.scanned_at = {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {})
        };
    }

    const status = String(filters.status || "").trim();
    if (status === "denied") {
        where.status = { not: "authorized" };
    } else if (SCAN_STATUSES.has(status)) {
        where.status = status;
    }

    const search = String(filters.search || "").trim().slice(0, 100);
    if (search) {
        where.OR = [
            { qr_code: { unique_token: { contains: search, mode: "insensitive" } } },
            { qr_code: { holder_name: { contains: search, mode: "insensitive" } } },
            { qr_code: { event: { title: { contains: search, mode: "insensitive" } } } },
            { scanned_by: { full_name: { contains: search, mode: "insensitive" } } },
            { area: { area_name: { contains: search, mode: "insensitive" } } }
        ];
    }

    return where;
};

const formatScan = (scan) => ({
    id: scan.id,
    code: scan.qr_code?.unique_token?.slice(0, 8) || "N/A",
    holder: scan.qr_code?.holder_name || "Titulaire inconnu",
    eventId: scan.qr_code?.event?.event_id || null,
    event: scan.qr_code?.event?.title || "Événement inconnu",
    areaId: scan.area?.area_id || null,
    area: scan.area?.area_name || "Zone non renseignée",
    agent: scan.scanned_by?.full_name || "Agent inconnu",
    time: scan.scanned_at,
    status: scan.status
});

exports.listForOrg = async (orgId, filters = {}) => {
    const page = boundedInteger(filters.page, 1, 1, 1_000_000);
    const pageSize = boundedInteger(filters.pageSize, 25, 10, 100);
    const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";
    const where = buildWhere(orgId, filters);

    const [total, scans, events, areas] = await Promise.all([
        prisma.scanLog.count({ where }),
        prisma.scanLog.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: [
                { scanned_at: sortOrder },
                { id: sortOrder }
            ],
            include: {
                qr_code: {
                    select: {
                        unique_token: true,
                        holder_name: true,
                        event: { select: { event_id: true, title: true } }
                    }
                },
                scanned_by: { select: { full_name: true } },
                area: { select: { area_id: true, area_name: true } }
            }
        }),
        prisma.event.findMany({
            where: { org_id: orgId },
            select: { event_id: true, title: true },
            orderBy: { title: "asc" }
        }),
        prisma.area.findMany({
            where: { org_id: orgId },
            select: { area_id: true, area_name: true },
            orderBy: { area_name: "asc" }
        })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
        scans: scans.map(formatScan),
        pagination: {
            page,
            pageSize,
            total,
            totalPages,
            hasPrevious: page > 1,
            hasNext: page < totalPages
        },
        options: {
            events: events.map(event => ({ id: event.event_id, name: event.title })),
            areas: areas.map(area => ({ id: area.area_id, name: area.area_name }))
        }
    };
};

exports.buildWhere = buildWhere;

