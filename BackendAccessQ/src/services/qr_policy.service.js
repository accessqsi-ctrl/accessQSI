const { getEffectiveQrStatus, QR_STATUS } = require("./qr_status.service");

const deniedDecision = (scanStatus, reason, areaId = null) => ({
    httpStatus: 200,
    success: false,
    message: "Accès Refusé",
    reason,
    scanStatus,
    shouldRecord: true,
    areaId
});

exports.evaluateQrScan = (qr, scannerOrgId, now = new Date(), requestedAreaId = null) => {
    if (!qr) {
        return {
            httpStatus: 404,
            success: false,
            message: "QR Code non reconnu ou inexistant.",
            shouldRecord: false
        };
    }

    if (qr.deleted_at || qr.event?.deleted_at || qr.event?.organization?.deleted_at || qr.event?.organization?.is_active === false) {
        return {
            httpStatus: 410,
            success: false,
            message: "Ce QR Code n'est plus actif.",
            shouldRecord: false
        };
    }

    if (qr.event.org_id !== scannerOrgId) {
        return {
            httpStatus: 403,
            success: false,
            message: "Ce QR Code n'appartient pas à votre organisation.",
            shouldRecord: false
        };
    }

    if (
        qr.event?.entitlement_type === "EVENT_PASS"
        && qr.event?.entitlement_expires_at
        && now > new Date(qr.event.entitlement_expires_at)
    ) {
        return deniedDecision("denied_event_inactive", "Le Pass de cet événement a expiré.");
    }

    const effectiveStatus = getEffectiveQrStatus(qr, now);

    if (effectiveStatus === QR_STATUS.REVOKED) {
        return deniedDecision("denied_revoked", "Ce QR Code a été révoqué par un administrateur.");
    }

    if (effectiveStatus === QR_STATUS.USED_UP) {
        return deniedDecision("denied_limit_reached", "Limite d'utilisation atteinte.");
    }

    if (effectiveStatus === QR_STATUS.EXPIRED) {
        return deniedDecision("denied_expired", "Ce QR Code est expiré.");
    }

    if (qr.valid_from && now < new Date(qr.valid_from)) {
        return deniedDecision("denied_expired", `Valide à partir de : ${new Date(qr.valid_from).toLocaleString()}`);
    }

    const schedules = Array.isArray(qr.event?.EventSchedules) ? qr.event.EventSchedules : [];
    let areaId = null;

    if (schedules.length > 0) {
        const normalizedAreaId = Number(requestedAreaId);
        if (!Number.isInteger(normalizedAreaId)) {
            return deniedDecision("denied_area_not_allowed", "Sélectionnez la zone de contrôle avant de scanner.");
        }

        const schedule = schedules.find(item => item.id_area === normalizedAreaId);
        if (!schedule) {
            return deniedDecision("denied_area_not_allowed", "Cette zone n'est pas autorisée pour cet événement.");
        }

        areaId = normalizedAreaId;
        if (now < new Date(schedule.start_date) || now > new Date(schedule.end_date)) {
            return deniedDecision("denied_event_inactive", "L'accès à cette zone est fermé pour le moment.", areaId);
        }

        const requiredLevel = Number(schedule.area?.accreditation_level || 0);
        const qrLevel = Number(qr.level || 0);
        if (qrLevel < requiredLevel) {
            return deniedDecision(
                "denied_insufficient_level",
                `Niveau d'accréditation insuffisant : niveau ${requiredLevel} requis.`,
                areaId
            );
        }
    }

    return {
        httpStatus: 200,
        success: true,
        message: "Accès Autorisé",
        reason: "",
        scanStatus: "authorized",
        shouldRecord: true,
        shouldMarkUsedUp: qr.usage_limit > 0 && (qr.scans_count + 1) >= qr.usage_limit,
        remaining: qr.usage_limit > 0 ? Math.max(0, qr.usage_limit - (qr.scans_count + 1)) : "Illimité",
        areaId
    };
};
