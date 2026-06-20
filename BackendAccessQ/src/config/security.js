const splitOrigins = (value) => {
    if (!value) return [];

    return value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
};

const getAllowedOrigins = (env = process.env) => [
    ...splitOrigins(env.FRONTEND_URL),
    ...splitOrigins(env.ADMIN_URL),
    ...splitOrigins(env.CORS_ORIGINS)
];

const isOriginAllowed = (origin, allowedOrigins) => {
    if (!origin) return true;
    return allowedOrigins.includes(origin);
};

const getSameSite = (env = process.env) => {
    const configured = (env.COOKIE_SAMESITE || "").toLowerCase();
    const allowed = ["strict", "lax", "none"];

    if (allowed.includes(configured)) return configured;

    return env.NODE_ENV === "production" ? "none" : "lax";
};

const getSecureCookie = (env = process.env, sameSite = getSameSite(env)) => {
    if (env.COOKIE_SECURE === "true") return true;
    if (env.COOKIE_SECURE === "false") return false;

    return env.NODE_ENV === "production" || sameSite === "none";
};

const getSessionCookieOptions = (env = process.env) => {
    const sameSite = getSameSite(env);

    return {
        httpOnly: true,
        secure: getSecureCookie(env, sameSite),
        sameSite
    };
};

module.exports = {
    getAllowedOrigins,
    getSameSite,
    getSecureCookie,
    getSessionCookieOptions,
    isOriginAllowed
};
