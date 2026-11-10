const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { normalizeEmail } = require("../utils/account");

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

// Limiteurs de connexion (anti brute-force). Seuls les échecs comptent : une équipe entière qui se connecte depuis
// le même réseau (Wi-Fi du lieu, partage de connexion) partage une seule adresse IP et ne doit pas se bloquer.
// - Par compte : 10 échecs par quart d'heure pour une même adresse e-mail depuis une même IP.
// - Par IP : 50 échecs par quart d'heure, toutes adresses confondues (balayage de comptes).
const loginMessage = { success: false, message: "Trop de tentatives de connexion, veuillez réessayer après 15 minutes." };
const loginAccountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${normalizeEmail(req.body?.email)}`,
    message: loginMessage,
    standardHeaders: false,
    legacyHeaders: false,
});
const loginIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    skipSuccessfulRequests: true,
    message: loginMessage,
    standardHeaders: false,
    legacyHeaders: false,
});
const loginLimiter = [loginIpLimiter, loginAccountLimiter];

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

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, message: "Trop de demandes. Veuillez réessayer dans une heure." },
    standardHeaders: "draft-7",
    legacyHeaders: false,
});

const publicRegistrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: { success: false, message: "Trop de tentatives. Veuillez réessayer plus tard." },
    standardHeaders: "draft-7",
    legacyHeaders: false
});

const registrationRecoveryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: true, message: "Si des pass correspondent, de nouveaux liens seront envoyés." },
    standardHeaders: "draft-7",
    legacyHeaders: false
});

// Envoi des codes de connexion à la box : limite le spam d'emails par adresse IP.
const attendeeCodeRequestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, message: "Trop de codes demandés. Veuillez réessayer dans une heure." },
    standardHeaders: "draft-7",
    legacyHeaders: false
});

// Saisie du code ou du mot de passe : chaque code est déjà borné à 5 essais, ceci freine le balayage d'adresses.
const attendeeLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: "Trop de tentatives. Veuillez réessayer dans 15 minutes." },
    standardHeaders: "draft-7",
    legacyHeaders: false
});

module.exports = { generalLimiter, loginLimiter, signinLimiter, refreshLimiter, verificationEmailLimiter, passwordResetLimiter, publicRegistrationLimiter, registrationRecoveryLimiter, attendeeCodeRequestLimiter, attendeeLoginLimiter };
