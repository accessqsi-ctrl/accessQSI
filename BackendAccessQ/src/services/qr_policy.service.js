exports.evaluateQrScan = (qr, scannerOrgId, now = new Date()) => {
    if (!qr) {
        return {
            httpStatus: 404,
            success: false,
            message: "QR Code non reconnu ou inexistant.",
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

    let scanStatus = "authorized";
    let denialReason = "";

    if (qr.status === "revoked") {
        scanStatus = "denied_revoked";
        denialReason = "Ce QR Code a été révoqué par un administrateur.";
    } else if (qr.usage_limit > 0 && qr.scans_count >= qr.usage_limit) {
        scanStatus = "denied_limit_reached";
        denialReason = "Limite d'utilisation atteinte.";
    } else if (qr.valid_from && now < new Date(qr.valid_from)) {
        scanStatus = "denied_expired";
        denialReason = `Valide à partir de : ${new Date(qr.valid_from).toLocaleString()}`;
    } else if (qr.valid_until && now > new Date(qr.valid_until)) {
        scanStatus = "denied_expired";
        denialReason = "Ce QR Code est expiré.";
    }

    const isAuthorized = scanStatus === "authorized";

    return {
        httpStatus: 200,
        success: isAuthorized,
        message: isAuthorized ? "Accès Autorisé" : "Accès Refusé",
        reason: denialReason,
        scanStatus,
        shouldRecord: true,
        shouldMarkUsedUp: isAuthorized && qr.usage_limit > 0 && (qr.scans_count + 1) >= qr.usage_limit,
        remaining: qr.usage_limit > 0 ? (qr.usage_limit - (qr.scans_count + 1)) : "Illimité"
    };
};
