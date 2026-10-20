// Règles de mot de passe, jetons de compte et gestion des cookies de session partagés par les contrôleurs.
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const PasswordValidator = require('password-validator');
const { getSessionCookieOptions } = require("../config/security");
const { getPrivateKey } = require("../config/jwtKeys");
const pm = new PasswordValidator();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

pm
    .is().min(8)
    .is().max(100)
    .has().uppercase()
    .has().lowercase()
    .has().digits()
    .has().symbols()
    .has().not().spaces();

const passwordPolicyMessage = "Le mot de passe doit contenir entre 8 et 100 caractères, avec au moins une majuscule, une minuscule, un chiffre, un symbole, et aucun espace.";

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
const parsedSaltRounds = Number.parseInt(process.env.SALT_ROUNDS, 10);
const BCRYPT_SALT_ROUNDS = Number.isInteger(parsedSaltRounds) && parsedSaltRounds >= 4 && parsedSaltRounds <= 31
    ? parsedSaltRounds
    : 10;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;
const newVerificationToken = () => crypto.randomBytes(32).toString("hex");
const newPasswordResetToken = () => crypto.randomBytes(32).toString("hex");
const hashPasswordResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const loginFingerprint = (email) => crypto.createHash("sha256").update(email).digest("hex").slice(0, 12);
const credentialHashMetadata = (hash) => {
    const value = String(hash || "");
    const match = value.match(/^\$(2[aby])\$(\d{2})\$/);
    return {
        credential_hash_format: match ? "bcrypt" : "unknown",
        credential_hash_variant: match?.[1],
        credential_hash_cost: match ? Number(match[2]) : undefined,
        credential_hash_length: value.length
    };
};

const durationToMs = (duration, fallbackMs) => {
    if (!duration || typeof duration !== "string") return fallbackMs;

    const match = duration.trim().match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) return fallbackMs;

    const value = Number(match[1]);
    const unit = match[2];
    const multipliers = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    return value * multipliers[unit];
};

// =========================================================
// CONFIGURATION SÉCURISÉE DES COOKIES (Protection des Sessions)
// =========================================================
// En plaçant notre Token JWT (Json Web Token) dans un cookie,
// nous protégeons l'application contre les attaques de type:
// - Session Hijacking (Vol de session via XSS)
// - Session Fixation (Forcer l'identifiant de session d'un utilisateur)
const cookieOptions = {
    ...getSessionCookieOptions()
};

const accessCookieOptions = {
    ...cookieOptions,
    maxAge: durationToMs(ACCESS_TOKEN_EXPIRES_IN, 15 * 60 * 1000)
};

const refreshCookieOptions = {
    ...cookieOptions,
    maxAge: durationToMs(REFRESH_TOKEN_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000)
};

const clearSessionCookies = (res) => {
    res.clearCookie("token", { ...cookieOptions, maxAge: 0 });
    res.clearCookie("refreshToken", { ...cookieOptions, maxAge: 0 });
};

const buildTokenPayload = (user, tokenType) => ({
    user_id: user.user_id,
    email: user.email,
    role: user.role,
    session_version: Number(user.session_version || 0),
    org_id: user.org_id,
    token_type: tokenType
});

const issueSession = (res, user) => {
    const accessToken = jwt.sign(
        buildTokenPayload(user, "access"),
        getPrivateKey(),
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN, algorithm: "RS256" }
    );

    const refreshToken = jwt.sign(
        buildTokenPayload(user, "refresh"),
        getPrivateKey(),
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN, algorithm: "RS256" }
    );

    res.cookie("token", accessToken, accessCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    return { accessToken, refreshToken };
};

module.exports = {
    pm,
    emailPattern,
    passwordPolicyMessage,
    BCRYPT_SALT_ROUNDS,
    VERIFICATION_TOKEN_TTL_MS,
    VERIFICATION_RESEND_COOLDOWN_MS,
    PASSWORD_RESET_TOKEN_TTL_MS,
    PASSWORD_RESET_RESEND_COOLDOWN_MS,
    newVerificationToken,
    newPasswordResetToken,
    hashPasswordResetToken,
    normalizeEmail,
    loginFingerprint,
    credentialHashMetadata,
    cookieOptions,
    accessCookieOptions,
    clearSessionCookies,
    issueSession
};
