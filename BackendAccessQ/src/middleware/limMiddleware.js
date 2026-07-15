const rateLimit = require("express-rate-limit");

// Limiteur global (filet de sécurité contre les abus et attaques DDoS basiques)
// Appliqué à toutes les routes dans app.js. Les limites sont généreuses pour ne pas
// gêner les utilisateurs légitimes, mais suffisantes pour bloquer les bots agressifs.
const configuredGeneralMax = Number.parseInt(process.env.GENERAL_RATE_LIMIT_MAX, 10);
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number.isInteger(configuredGeneralMax) && configuredGeneralMax > 0 ? configuredGeneralMax : 2000,
    message: { success: false, message: "Trop de requêtes, veuillez réessayer plus tard." },
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV !== "production",
});

// Limiteur pour les routes d'authentification (anti brute-force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: "Trop de tentatives de connexion, veuillez réessayer après 15 minutes." },
    standardHeaders: false,
    legacyHeaders: false,
});

// Limiteur pour la création de comptes (anti spam d'inscriptions)
// Plus souple que le loginLimiter, car le risque est le spam plutôt que le brute-force.
// Chaque inscription déclenche un email de vérification → à protéger contre la saturation.
const signinLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // Fenêtre de temps : 1 heure
    max: 5, // Limite : 5 inscriptions maximum par adresse IP par heure
    message: { success: false, message: "Trop de tentatives d'inscription, veuillez réessayer dans une heure." },
    standardHeaders: false,
    legacyHeaders: false,
});

const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, message: "Trop de tentatives de renouvellement, veuillez réessayer plus tard." },
    standardHeaders: false,
    legacyHeaders: false,
});

const verificationEmailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, message: "Trop de demandes. Veuillez réessayer dans une heure." },
    standardHeaders: false,
    legacyHeaders: false,
});

module.exports = { generalLimiter, loginLimiter, signinLimiter, refreshLimiter, verificationEmailLimiter };
