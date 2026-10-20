const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const userService = require("../services/user.service");
const emailService = require("../services/email.service");
const prisma = require("../prisma/client");
const { getPublicKey } = require("../config/jwtKeys");
const logger = require("../utils/logger");
const { getPlanSummary } = require("../config/subscription");
const { evaluateAccess, findUserAccessState } = require("../services/account_access.service");
const {
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
} = require("../utils/account");

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

        const currentUser = await findUserAccessState(user.user_id);
        const access = evaluateAccess(currentUser);
        if (!access.allowed) {
            logger.warn("auth.login_denied", {
                reason: access.code,
                request_id: req.requestId,
                ip: req.ip,
                login_fingerprint: fingerprint,
                user_id: user.user_id,
                org_id: user.org_id
            });
            clearSessionCookies(res);
            return res.status(403).json({
                success: false,
                code: access.code,
                message: "Accès refusé. Le compte ou l’organisation n’est pas actif."
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

        const sessionUser = {
            ...user,
            role: currentUser.role,
            org_id: currentUser.org_id
        };
        const { accessToken } = issueSession(res, sessionUser);
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

    jwt.verify(refreshToken, getPublicKey(), { algorithms: ["RS256"] }, async (err, decoded) => {
        if (err || decoded.token_type !== "refresh") {
            logger.warn("session.refresh_failed", {
                reason: err ? "invalid_refresh_token" : "wrong_token_type",
                request_id: req.requestId,
                ip: req.ip,
                user_id: decoded?.user_id,
                org_id: decoded?.org_id,
                error: err
            });
            clearSessionCookies(res);
            return res.status(403).json({ success: false, message: "Session invalide." });
        }

        try {
            const currentUser = await findUserAccessState(decoded.user_id);
            const access = evaluateAccess(currentUser, decoded);
            if (!access.allowed) {
                logger.warn("session.refresh_failed", {
                    reason: access.code,
                    request_id: req.requestId,
                    user_id: decoded.user_id,
                    org_id: decoded.org_id
                });
                clearSessionCookies(res);
                return res.status(403).json({
                    success: false,
                    code: access.code,
                    message: "Session révoquée. Le compte ou l’organisation n’est pas actif."
                });
            }

            const { accessToken } = issueSession(res, currentUser);
            logger.info("session.refreshed", {
                request_id: req.requestId,
                user_id: currentUser.user_id,
                org_id: currentUser.org_id
            });

            return res.status(200).json({
                success: true,
                message: "Session renouvelée.",
                token: accessToken
            });
        } catch (error) {
            logger.error("session.refresh_failed", { reason: "state_check_failed", request_id: req.requestId, error });
            return res.status(503).json({ success: false, message: "Impossible de vérifier la session pour le moment." });
        }
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
                password_reset_email_sent_at: null,
                session_version: { increment: 1 }
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

exports.logout = async (req, res) => {
    await prisma.userQ.update({
        where: { user_id: req.user.user_id },
        data: { session_version: { increment: 1 } }
    });
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
