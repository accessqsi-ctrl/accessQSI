const statusLabels = {
    authorized: "Autorisé",
    denied_expired: "QR expiré",
    denied_revoked: "QR révoqué",
    denied_limit_reached: "Limite atteinte",
    denied_event_inactive: "Événement inactif",
    denied_event_not_selected: "Mauvais événement",
    denied_area_not_allowed: "Zone non autorisée",
    denied_insufficient_level: "Niveau insuffisant"
};

export const scanStatusLabel = (status) => statusLabels[status] || "Refusé";

export const localDateTimeToIso = (date, time, fallbackTime) => {
    if (!date) return "";
    const value = new Date(`${date}T${time || fallbackTime}:00`);
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
};

export const buildScanLogQuery = ({ filters, page, pageSize }) => {
    const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortOrder: filters.sortOrder || "desc"
    });

    const from = localDateTimeToIso(filters.dateFrom, filters.timeFrom, "00:00");
    const to = localDateTimeToIso(filters.dateTo, filters.timeTo, "23:59");
    if (from) query.set("from", from);
    if (to) query.set("to", to);

    for (const key of ["eventId", "areaId", "status", "search"]) {
        const value = String(filters[key] || "").trim();
        if (value) query.set(key, value);
    }

    return query.toString();
};

