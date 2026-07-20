const QR_STATUS = Object.freeze({
    ACTIVE: "active",
    REVOKED: "revoked",
    EXPIRED: "expired",
    USED_UP: "used_up"
});

const getEffectiveQrStatus = (qr, now = new Date()) => {
    if (qr.status === QR_STATUS.REVOKED) return QR_STATUS.REVOKED;
    if (qr.status === QR_STATUS.EXPIRED || (qr.valid_until && new Date(qr.valid_until) < now)) {
        return QR_STATUS.EXPIRED;
    }
    if (qr.status === QR_STATUS.USED_UP || (qr.usage_limit > 0 && qr.scans_count >= qr.usage_limit)) {
        return QR_STATUS.USED_UP;
    }
    return QR_STATUS.ACTIVE;
};

const usageLimitFromAccessType = (accessType, limit) => {
    if (accessType === "unlimited") return 0;
    if (accessType === "multi") return limit;
    return 1;
};

const formatUsageLimit = (limit) => limit === 0 ? "Illimité" : limit;

module.exports = {
    QR_STATUS,
    getEffectiveQrStatus,
    usageLimitFromAccessType,
    formatUsageLimit
};
