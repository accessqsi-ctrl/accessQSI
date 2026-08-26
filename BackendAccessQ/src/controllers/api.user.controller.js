const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const userService = require("../services/user.service");
const emailService = require("../services/email.service");
const prisma = require("../prisma/client");
const { getSessionCookieOptions } = require("../config/security");
const { getPrivateKey, getPublicKey } = require("../config/jwtKeys");
const logger = require("../utils/logger");
const PasswordValidator = require('password-validator');
const { getPlanSummary, getPlanUsage } = require("../config/subscription");
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

const buildTokenPayload = (user, tokenType) => ({
    user_id: user.user_id,
    email: user.email,
    role: user.role,
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

exports.login = async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const password = typeof req.body.password === "string" ? req.body.password : "";
        if (!email) {
            logger.warn("auth.login_denied", { reason: "missing_email", request_id: req.requestId, ip: req.ip });
            return res.status(400).json({ success: false, message: "L’adresse e-mail est requise." });
        }
        const fingerprint = loginFingerprint(email);
        if (!emailPattern.test(email)) {
            logger.warn("auth.login_denied", { reason: "invalid_email", request_id: req.requestId, ip: req.ip, login_fingerprint: fingerprint });
            return res.status(400).json({ success: false, message: "L’adresse e-mail saisie n’est pas valide." });
        }
        if (!password) {
            logger.warn("auth.login_denied", { reason: "missing_password", request_id: req.requestId, ip: req.ip, login_fingerprint: fingerprint });
            return res.status(400).json({ success: false, message: "Le mot de passe est requis." });
        }
        const user = await userService.findByEmail(email);
        if (!user) {
            logger.warn("auth.login_denied", {
                reason: "user_not_found",
                request_id: req.requestId,
                ip: req.ip,
                login_fingerprint: fingerprint,
                account_found: false
            });
            return res.status(401).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Adresse e-mail ou mot de passe incorrect."
            });
        }

        if (user.deleted_at !== null) {
            logger.warn("auth.login_denied", { reason: "account_disabled", request_id: req.requestId, ip: req.ip, login_fingerprint: fingerprint, user_id: user.user_id, org_id: user.org_id });
            return res.status(403).json({
                success: false,
                message: "Accès refusé. Ce compte a été désactivé par un administrateur."
            });
        }
        const credentialCheckStartedAt = Date.now();
        let validPassword = await bcrypt.compare(password, user.password_hash);
        let acceptedTrimmedPassword = false;
        const trimmedPassword = password.trim();
        // L'inscription historique supprimait les espaces extérieurs avant le hash.
        // Ce second essai garde ces comptes utilisables après un collage sur mobile.
        if (!validPassword && trimmedPassword && trimmedPassword !== password) {
            validPassword = await bcrypt.compare(trimmedPassword, user.password_hash);
            acceptedTrimmedPassword = validPassword;
        }
        if (!validPassword) {
            logger.warn("auth.login_denied", {
                reason: "password_mismatch",
                request_id: req.requestId,
                ip: req.ip,
                login_fingerprint: fingerprint,
                account_found: true,
                user_id: user.user_id,
                org_id: user.org_id,
                credential_check_ms: Date.now() - credentialCheckStartedAt,
                credential_had_outer_whitespace: trimmedPassword !== password,
                ...credentialHashMetadata(user.password_hash)
            });
            return res.status(401).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Adresse e-mail ou mot de passe incorrect."
            });
        }

        // --- VÉRIFICATION DE L'EMAIL ---
        if (!user.is_verified) {
            logger.warn("auth.login_denied", { reason: "email_not_verified", request_id: req.requestId, ip: req.ip, login_fingerprint: fingerprint, user_id: user.user_id, org_id: user.org_id });
            return res.status(403).json({
                success: false,
                code: "EMAIL_NOT_VERIFIED",
                canResend: true,
                message: "Veuillez vérifier votre adresse email avant de vous connecter. Consultez votre boîte de réception."
            });
        }

        const firstLogin = user.last_login === null;
        let welcomeOffer = null;

        if (firstLogin && user.org_id) {
            const organization = await prisma.organization.findUnique({
                where: { org_id: user.org_id },
                include: { plan: true }
            });
            const planSummary = getPlanSummary(organization);
            if (planSummary.plan === "ESSENTIAL" && planSummary.isTrial) {
                welcomeOffer = {
                    plan: planSummary.plan,
                    planName: planSummary.planName,
                    expiresAt: planSummary.trialExpiresAt || planSummary.expiresAt,
                    features: planSummary.features
                };
            }
        }

        await prisma.userQ.update({
            where: { user_id: user.user_id },
            data: { last_login: new Date() }
        });

        const { accessToken } = issueSession(res, user);
        logger.info("auth.login_succeeded", {
            request_id: req.requestId,
            ip: req.ip,
            login_fingerprint: fingerprint,
            user_id: user.user_id,
            org_id: user.org_id,
            role: user.role,
            accepted_trimmed_credential: acceptedTrimmedPassword,
            session_secure: accessCookieOptions.secure,
            session_same_site: accessCookieOptions.sameSite
        });

        // Le JWT d'accès reste renvoyé pour les clients mobiles, mais le web utilise les cookies HttpOnly.

        return res.status(200).json({
            success: true,
            message: "Connexion réussie",
            token: accessToken, // Optionnel pour les apps mobiles, NextJS doit utiliser le cookie
            welcomeOffer,
            user: {
                user_id: user.user_id,
                name: user.full_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        logger.error("auth.login_failed", { reason: "internal_error", request_id: req.requestId, ip: req.ip, error });
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la connexion."
        });
    }
};

exports.refreshSession = async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
        logger.warn("session.refresh_failed", {
            reason: "missing_refresh_token",
            request_id: req.requestId,
            ip: req.ip
        });
        return res.status(401).json({ success: false, message: "Session expirée. Veuillez vous reconnecter." });
    }

    jwt.verify(refreshToken, getPublicKey(), { algorithms: ["RS256"] }, (err, decoded) => {
        if (err || decoded.token_type !== "refresh") {
            logger.warn("session.refresh_failed", {
                reason: err ? "invalid_refresh_token" : "wrong_token_type",
                request_id: req.requestId,
                ip: req.ip,
                user_id: decoded?.user_id,
                org_id: decoded?.org_id,
                error: err
            });
            return res.status(403).json({ success: false, message: "Session invalide." });
        }

        const { accessToken } = issueSession(res, decoded);
        logger.info("session.refreshed", {
            request_id: req.requestId,
            user_id: decoded.user_id,
            org_id: decoded.org_id
        });

        return res.status(200).json({
            success: true,
            message: "Session renouvelée.",
            token: accessToken
        });
    });
};



exports.signin = async (req, res) => {
    try {
        const { fullName, email, organizationName, password } = req.body;

        if (!fullName || !email || !organizationName || !password) {
            return res.status(400).json({ success: false, message: "Tous les champs obligatoires doivent être remplis." });
        }

        // Appliquer la politique de mot de passe fort
        const errors = pm.validate(password.trim(), { list: true });
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: passwordPolicyMessage
            });
        }

        let user = await userService.findByEmail(email);

        if (!user) {
            const hashed = await bcrypt.hash(password.trim(), BCRYPT_SALT_ROUNDS);
            const clef = crypto.randomUUID(); // Génération d'une clef unique

            // --- NOUVEAU: GÉNÉRATION DU TOKEN DE VÉRIFICATION ---
            const verificationToken = newVerificationToken();

            const orgData = { name: organizationName };
            const userData = {
                clef: clef,
                full_name: fullName,
                email: email,
                password_hash: hashed,
                role: "ORG_ADMIN",
                is_verified: false,
                verification_token: verificationToken,
                verification_token_expires_at: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS)
            };

            const result = await userService.createOrgAndAdminUser(orgData, userData);

            // Envoi de l'e-mail simulé
            const emailSent = await emailService.sendVerificationEmail(email, fullName, verificationToken);
            if (emailSent) {
                await prisma.userQ.update({ where: { user_id: result.user.user_id }, data: { verification_email_sent_at: new Date() } });
            }

            return res.status(201).json({
                success: true,
                emailSent,
                email,
                message: emailSent
                    ? "Compte créé avec un mois d’Essentiel offert. Un e-mail de vérification vous a été envoyé."
                    : "Compte créé avec un mois d’Essentiel offert, mais l’e-mail n’a pas pu être envoyé. Vous pouvez demander un nouvel envoi.",
            });
        } else {
            if (!user.is_verified) {
                return res.status(409).json({ success: false, code: "EMAIL_NOT_VERIFIED", canResend: true, email, message: "Ce compte existe déjà mais son adresse n’est pas vérifiée." });
            }
            return res.status(400).json({
                success: false,
                message: "Cet email est déjà pris"
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Une erreur s'est produite lors de l'inscription.{" + error + "}"
        });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: "Le jeton de vérification est requis." });
        }

        // Trouver l'utilisateur par son token de vérification
        const user = await prisma.userQ.findFirst({
            where: { verification_token: token, verification_token_expires_at: { gt: new Date() }, is_verified: false }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "Lien de vérification invalide ou expiré." });
        }

        // Valider l'utilisateur
        await prisma.userQ.update({
            where: { user_id: user.user_id },
            data: {
                is_verified: true,
                verification_token: null,
                verification_token_expires_at: null
            }
        });

        return res.status(200).json({
            success: true,
            message: "Votre adresse e-mail a été vérifiée avec succès. Vous pouvez maintenant vous connecter."
        });

    } catch (error) {
        console.error("Erreur de vérification : ", error);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de la vérification de l'e-mail." });
    }
};

exports.resendVerificationEmail = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        if (!email || !emailPattern.test(email)) return res.status(400).json({ success: false, message: "Adresse e-mail invalide." });
        const user = await userService.findByEmail(email);
        if (!user || user.is_verified) return res.status(202).json({ success: true, message: "Si ce compte nécessite une vérification, un e-mail sera envoyé." });
        const lastSent = user.verification_email_sent_at ? new Date(user.verification_email_sent_at).getTime() : 0;
        const retryAfter = Math.ceil((lastSent + VERIFICATION_RESEND_COOLDOWN_MS - Date.now()) / 1000);
        if (retryAfter > 0) return res.status(429).json({ success: false, retryAfter, message: `Veuillez patienter ${retryAfter} secondes avant un nouvel envoi.` });
        const token = newVerificationToken();
        await prisma.userQ.update({ where: { user_id: user.user_id }, data: { verification_token: token, verification_token_expires_at: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS) } });
        const sent = await emailService.sendVerificationEmail(user.email, user.full_name, token);
        if (!sent) return res.status(503).json({ success: false, message: "Le service d’e-mail est temporairement indisponible. Veuillez réessayer." });
        await prisma.userQ.update({ where: { user_id: user.user_id }, data: { verification_email_sent_at: new Date() } });
        return res.status(202).json({ success: true, message: "Un nouvel e-mail de vérification a été envoyé." });
    } catch (error) {
        logger.error("verification_email.resend_failed", { error, request_id: req.requestId });
        return res.status(500).json({ success: false, message: "Impossible de renvoyer l’e-mail pour le moment." });
    }
};

const passwordResetRequestMessage = "Si un compte actif correspond à cette adresse, un e-mail de réinitialisation sera envoyé.";

exports.forgotPassword = async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!email || !emailPattern.test(email)) {
            return res.status(400).json({ success: false, message: "Adresse e-mail invalide." });
        }

        const user = await userService.findByEmail(email);
        if (!user || user.deleted_at || user.is_active === false) {
            return res.status(202).json({ success: true, message: passwordResetRequestMessage });
        }

        const lastSent = user.password_reset_email_sent_at
            ? new Date(user.password_reset_email_sent_at).getTime()
            : 0;
        if (lastSent + PASSWORD_RESET_RESEND_COOLDOWN_MS > Date.now()) {
            return res.status(202).json({ success: true, message: passwordResetRequestMessage });
        }

        const token = newPasswordResetToken();
        await prisma.userQ.update({
            where: { user_id: user.user_id },
            data: {
                password_reset_token_hash: hashPasswordResetToken(token),
                password_reset_expires_at: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS)
            }
        });

        const sent = await emailService.sendPasswordResetEmail(user.email, user.full_name, token);
        if (sent) {
            await prisma.userQ.update({
                where: { user_id: user.user_id },
                data: { password_reset_email_sent_at: new Date() }
            });
        } else {
            await prisma.userQ.update({
                where: { user_id: user.user_id },
                data: { password_reset_token_hash: null, password_reset_expires_at: null }
            });
        }

        return res.status(202).json({ success: true, message: passwordResetRequestMessage });
    } catch (error) {
        logger.error("password_reset.request_failed", { error, request_id: req.requestId });
        return res.status(500).json({ success: false, message: "Impossible de traiter la demande pour le moment." });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const token = typeof req.body.token === "string" ? req.body.token.trim() : "";
        const password = typeof req.body.password === "string" ? req.body.password : "";
        if (!token) {
            return res.status(400).json({ success: false, message: "Le lien de réinitialisation est invalide ou expiré." });
        }
        if (pm.validate(password, { list: true }).length > 0) {
            return res.status(400).json({ success: false, message: passwordPolicyMessage });
        }

        const tokenHash = hashPasswordResetToken(token);
        const user = await prisma.userQ.findFirst({
            where: {
                password_reset_token_hash: tokenHash,
                password_reset_expires_at: { gt: new Date() },
                deleted_at: null,
                is_active: true
            }
        });
        if (!user) {
            return res.status(400).json({ success: false, message: "Le lien de réinitialisation est invalide ou expiré." });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        const updated = await prisma.userQ.updateMany({
            where: {
                user_id: user.user_id,
                password_reset_token_hash: tokenHash,
                password_reset_expires_at: { gt: new Date() }
            },
            data: {
                password_hash: passwordHash,
                password_reset_token_hash: null,
                password_reset_expires_at: null,
                password_reset_email_sent_at: null
            }
        });
        if (updated.count !== 1) {
            return res.status(400).json({ success: false, message: "Le lien de réinitialisation est invalide ou expiré." });
        }

        res.clearCookie("token", cookieOptions);
        res.clearCookie("refreshToken", cookieOptions);
        logger.info("password_reset.completed", { request_id: req.requestId, user_id: user.user_id, org_id: user.org_id });
        return res.status(200).json({ success: true, message: "Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter." });
    } catch (error) {
        logger.error("password_reset.failed", { error, request_id: req.requestId });
        return res.status(500).json({ success: false, message: "Impossible de réinitialiser le mot de passe pour le moment." });
    }
};

exports.viewprofile = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const fullUser = await prisma.userQ.findUnique({
            where: { user_id: userId },
            select: { user_id: true, email: true, full_name: true, role: true, org_id: true }
        });

        if (!fullUser) {
            return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
        }

        const organization = fullUser.org_id
            ? await prisma.organization.findUnique({
                where: { org_id: fullUser.org_id },
                include: { plan: true }
            })
            : null;
        const planSummary = getPlanSummary(organization);
        const usageCounts = fullUser.org_id
            ? await Promise.all([
                prisma.event.count({
                    where: {
                        org_id: fullUser.org_id,
                        entitlement_type: "SUBSCRIPTION",
                        created_at: { gte: planSummary.cycleStartedAt, lt: planSummary.cycleEndsAt }
                    }
                }),
                prisma.qrCode.groupBy({
                    by: ["event_id"],
                    where: { event: { org_id: fullUser.org_id, deleted_at: null } },
                    _count: { _all: true }
                }),
                prisma.userQ.count({
                    where: {
                        org_id: fullUser.org_id,
                        role: { in: ["ORG_AGENT", "OPERATOR"] },
                        deleted_at: null,
                        is_active: true
                    }
                }),
                prisma.area.count({ where: { org_id: fullUser.org_id, deleted_at: null, suspended_by_plan: false } })
            ]).then(([events, qrGroups, agents, areas]) => ({
                events,
                qrCodes: Math.max(0, ...qrGroups.map(group => group._count._all)),
                agents,
                areas
            }))
            : { events: 0, qrCodes: 0, agents: 0, areas: 0 };

        const planUsage = getPlanUsage(planSummary, usageCounts);
        const subscription = {
            plan: planSummary.plan,
            planName: planSummary.planName,
            isPro: planSummary.isPro,
            planCurrency: planSummary.currency,
            planLimits: planSummary.limits,
            planUsage,
            planCapabilities: planSummary.capabilities,
            planFeatures: planSummary.features,
            subscriptionStartedAt: planSummary.startedAt,
            subscriptionExpiresAt: planSummary.expiresAt,
            subscriptionType: planSummary.subscriptionType,
            billingInterval: planSummary.billingInterval,
            downgraded: planSummary.downgraded,
            billingCycleStartedAt: planSummary.cycleStartedAt,
            billingCycleEndsAt: planSummary.cycleEndsAt,
            isTrial: planSummary.isTrial,
            trialAvailable: planSummary.trialAvailable,
            trialDurationDays: planSummary.trialDurationDays,
            trialStartedAt: planSummary.trialStartedAt,
            trialExpiresAt: planSummary.trialExpiresAt
        };

        return res.status(200).json({
            success: true,
            user: {
                ...fullUser,
                ...subscription,
                subscription
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Erreur lors du chargement du profil."
        });
    }
};

exports.logout = async (req, res) => {
    // Supprimer le cookie sécurisé pour détruire complètement le contexte de session côté client
    res.clearCookie("token", { ...cookieOptions, maxAge: 0 });
    res.clearCookie("refreshToken", { ...cookieOptions, maxAge: 0 });
    logger.info("session.logout", {
        request_id: req.requestId,
        user_id: req.user?.user_id,
        org_id: req.user?.org_id
    });

    return res.status(200).json({
        success: true,
        message: "Déconnexion réussie."
    });
};
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { fullName, email } = req.body;
        const isAgent = req.user.role === "ORG_AGENT";

        if (!fullName || (!isAgent && !email)) {
            return res.status(400).json({ success: false, message: isAgent ? "Nom requis." : "Nom et email requis." });
        }

        let emailToSave = email;
        if (isAgent) {
            const currentUser = await prisma.userQ.findUnique({
                where: { user_id: userId },
                select: { email: true }
            });
            if (!currentUser) {
                return res.status(404).json({ success: false, message: "Utilisateur introuvable." });
            }
            if (email && email.trim().toLowerCase() !== currentUser.email.toLowerCase()) {
                return res.status(403).json({
                    success: false,
                    message: "Un agent ne peut pas modifier son adresse e-mail."
                });
            }
            emailToSave = currentUser.email;
        } else {
            const existing = await userService.findByEmail(email);
            if (existing && existing.user_id !== userId) {
                return res.status(400).json({ success: false, message: "Cet email est déjà utilisé." });
            }
        }

        const updated = await userService.updateUser(userId, {
            full_name: fullName,
            ...(isAgent ? {} : { email: emailToSave })
        });

        return res.status(200).json({
            success: true,
            message: "Profil mis à jour avec succès.",
            user: {
                user_id: updated.user_id,
                name: updated.full_name,
                email: updated.email || emailToSave
            }
        });
    } catch (error) {
        console.error("Erreur updateProfile:", error);
        return res.status(500).json({ success: false, message: "Erreur lors de la mise à jour." });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "Ancien et nouveau mot de passe requis." });
        }

        const user = await prisma.userQ.findUnique({ where: { user_id: userId } });
        const valid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!valid) {
            return res.status(400).json({ success: false, message: "Ancien mot de passe incorrect." });
        }

        const errors = pm.validate(newPassword.trim(), { list: true });
        if (errors.length > 0) {
            return res.status(400).json({ success: false, message: passwordPolicyMessage });
        }

        const hashed = await bcrypt.hash(newPassword.trim(), BCRYPT_SALT_ROUNDS);
        await userService.updateUser(userId, { password_hash: hashed });

        return res.status(200).json({ success: true, message: "Mot de passe modifié avec succès." });
    } catch (error) {
        console.error("Erreur updatePassword:", error);
        return res.status(500).json({ success: false, message: "Erreur lors de la modification du mot de passe." });
    }
};

exports.updateOrganization = async (req, res) => {
    try {
        if (req.user.role !== "ORG_ADMIN" && req.user.role !== "SUPER_ADMIN") {
            return res.status(403).json({ success: false, message: "Droits insuffisants." });
        }

        const orgId = req.user.org_id;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: "Nom de l'organisation requis." });
        }

        await userService.updateOrganization(orgId, { name: name });

        return res.status(200).json({ success: true, message: "Organisation mise à jour." });
    } catch (error) {
        console.error("Erreur updateOrganization:", error);
        return res.status(500).json({ success: false, message: "Erreur lors de la mise à jour." });
    }
};

exports.getOrganization = async (req, res) => {
    try {
        const orgId = req.user.org_id;
        const org = await userService.getOrganizationById(orgId);
        return res.status(200).json({ success: true, organization: org });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erreur serveur, organisation introuvable." });
    }
};

exports.deleteOrganization = async (req, res) => {
    try {
        const { org_id, role } = req.user;

        // Vérifier que l'utilisateur est un ORG_ADMIN
        if (role !== "ORG_ADMIN") {
            return res.status(403).json({ success: false, message: "Accès refusé. Réservé à l'administrateur de l'organisation." });
        }

        if (!org_id) {
            return res.status(400).json({ success: false, message: "Aucune organisation liée à cet utilisateur." });
        }

        // Suppression logique de l'organisation et de ses utilisateurs
        await userService.deleteOrganization(org_id);

        // Supprimer le cookie de session
        res.clearCookie("token");

        return res.status(200).json({ success: true, message: "Organisation supprimée avec succès." });
    } catch (error) {
        console.error("Erreur deleteOrganization:", error);
        return res.status(500).json({ success: false, message: "Erreur lors de la suppression de l'organisation." });
    }
};
