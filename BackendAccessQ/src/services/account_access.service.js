const prisma = require("../prisma/client");

const ACCESS_DENIAL = Object.freeze({
    ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
    ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
    ORGANIZATION_DISABLED: "ORGANIZATION_DISABLED",
    TOKEN_STATE_STALE: "TOKEN_STATE_STALE"
});

const evaluateAccess = (user, tokenClaims = null) => {
    if (!user) return { allowed: false, code: ACCESS_DENIAL.ACCOUNT_NOT_FOUND };
    if (user.deleted_at || user.is_active === false) {
        return { allowed: false, code: ACCESS_DENIAL.ACCOUNT_DISABLED };
    }
    if (user.org_id !== null && user.org_id !== undefined) {
        if (!user.organization || user.organization.deleted_at || user.organization.is_active === false) {
            return { allowed: false, code: ACCESS_DENIAL.ORGANIZATION_DISABLED };
        }
    }
    if (tokenClaims && (
        Number(tokenClaims.user_id) !== Number(user.user_id)
        || tokenClaims.role !== user.role
        || Number(tokenClaims.org_id ?? 0) !== Number(user.org_id ?? 0)
    )) {
        return { allowed: false, code: ACCESS_DENIAL.TOKEN_STATE_STALE };
    }
    return { allowed: true, code: null };
};

const findUserAccessState = (userId, dbClient = prisma) => dbClient.userQ.findUnique({
    where: { user_id: Number(userId) },
    select: {
        user_id: true,
        email: true,
        role: true,
        org_id: true,
        is_active: true,
        deleted_at: true,
        organization: {
            select: { org_id: true, is_active: true, deleted_at: true }
        }
    }
});

module.exports = { ACCESS_DENIAL, evaluateAccess, findUserAccessState };
