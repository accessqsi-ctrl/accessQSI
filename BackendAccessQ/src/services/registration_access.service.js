const crypto = require("crypto");
const prisma = require("../prisma/client");

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const hashToken = token => crypto.createHash("sha256").update(String(token || "")).digest("hex");

const createAccessToken = async (registrationId, options = {}, dbClient = prisma) => {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const expiresAt = options.expiresAt || new Date(Date.now() + (options.ttlMs || DEFAULT_TTL_MS));
    await dbClient.registrationAccessToken.create({
        data: {
            registration_id: registrationId,
            token_hash: hashToken(rawToken),
            expires_at: expiresAt
        }
    });
    return { rawToken, expiresAt };
};

const resolveAccessToken = async (rawToken, options = {}) => {
    const now = options.now || new Date();
    const tokenHash = hashToken(rawToken);
    const access = await prisma.registrationAccessToken.findUnique({
        where: { token_hash: tokenHash },
        include: {
            registration: {
                include: {
                    form: { select: { title: true, public_slug: true } },
                    offer: { select: { name: true } },
                    event: { include: { EventSchedules: { include: { area: true }, orderBy: { start_date: "asc" } } } },
                    qr_code: true
                }
            }
        }
    });
    if (!access || access.revoked_at || access.expires_at <= now) return null;
    await prisma.registrationAccessToken.update({
        where: { registration_access_token_id: access.registration_access_token_id },
        data: { last_used_at: now }
    });
    return access;
};

const revokeRegistrationTokens = registrationId => prisma.registrationAccessToken.updateMany({
    where: { registration_id: registrationId, revoked_at: null },
    data: { revoked_at: new Date() }
});

module.exports = { createAccessToken, hashToken, resolveAccessToken, revokeRegistrationTokens };
