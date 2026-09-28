const { getAllowedOrigins, isOriginAllowed } = require("../config/security");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const requestOrigin = (req) => {
    const origin = req.get?.("origin");
    if (origin) return origin;

    const referer = req.get?.("referer");
    if (!referer) return null;
    try {
        return new URL(referer).origin;
    } catch {
        return null;
    }
};

const ownOrigin = (req) => {
    const host = req.get?.("host");
    if (!host) return null;
    return `${req.protocol || "http"}://${host}`;
};

const csrfProtection = (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const authorization = String(req.get?.("authorization") || "");
    if (/^Bearer\s+\S+/i.test(authorization)) return next();

    const origin = requestOrigin(req);
    const allowedOrigins = getAllowedOrigins();
    const serverOrigin = ownOrigin(req);
    const originAllowed = Boolean(
        origin
        && (
            isOriginAllowed(origin, allowedOrigins)
            || (serverOrigin && origin === serverOrigin)
        )
    );

    if (originAllowed) return next();

    const hasSessionCookie = Boolean(req.cookies?.token || req.cookies?.refreshToken);
    if (!origin && !hasSessionCookie) {
        // Appels serveur-à-serveur (callbacks de paiement, CLI) sans session web.
        return next();
    }

    return res.status(403).json({
        success: false,
        code: "CSRF_ORIGIN_INVALID",
        message: "Origine de la requête non autorisée."
    });
};

csrfProtection.requestOrigin = requestOrigin;

module.exports = csrfProtection;
