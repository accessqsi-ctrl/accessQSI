const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const userService = require("../services/user.service");
const emailService = require("../services/email.service");
const prisma = require("../prisma/client");
const PasswordValidator = require('password-validator');
const fs = require("fs");
const privateKey = fs.readFileSync(process.env.PRIVATE_KEY);
const pm = new PasswordValidator();

pm
    .is().min(8)
    .is().max(100)
    .has().uppercase()
    .has().lowercase()
    .has().digits()
    .has().not().spaces();

// =========================================================
// CONFIGURATION SÉCURISÉE DES COOKIES (Protection des Sessions)
// =========================================================
// En plaçant notre Token JWT (Json Web Token) dans un cookie,
// nous protégeons l'application contre les attaques de type:
// - Session Hijacking (Vol de session via XSS)
// - Session Fixation (Forcer l'identifiant de session d'un utilisateur)
const cookieOptions = {
    httpOnly: true, // Empêche tout script JavaScript côté client (Cross-Site Scripting - XSS) de lire le cookie.
    secure: process.env.NODE_ENV === "production", // Autorise l'envoi du cookie UNIQUEMENT sur des connexions HTTPS chiffrées (en prod).
    sameSite: "strict", // Protection contre la falsification de requête intersite (CSRF). Le cookie ne sera pas envoyé si on clique sur un lien externe.
    maxAge: 100 * 24 * 60 * 60 * 1000 // Le token expire après 100 jours.
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "L'email et le mot de passe sont requis." });
        }
        const user = await userService.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Aucun compte trouvé pour cette adresse email."
            });
        }

        if (user.deleted_at !== null) {
            return res.status(403).json({
                success: false,
                message: "Accès refusé. Ce compte a été désactivé par un administrateur."
            });
        }
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "Mot de passe incorrect. Veuillez réessayer."
            });
        }

        // --- VÉRIFICATION DE L'EMAIL ---
        if (!user.is_verified) {
            return res.status(403).json({
                success: false,
                message: "Veuillez vérifier votre adresse email avant de vous connecter. Consultez votre boîte de réception."
            });
        }

        const token = jwt.sign(
            { user_id: user.user_id, email: user.email, role: user.role, org_id: user.org_id },
            privateKey,
            { expiresIn: process.env.TOKEN_EXPIRES_IN, algorithm: "RS256" }
        );

        // Mise à jour sécurité : stocker le JWT dans un cookie HttpOnly au lieu de l'envoyer uniquement en JSON
        res.cookie("token", token, cookieOptions);

        return res.status(200).json({
            success: true,
            message: "Connexion réussie",
            token: token, // Optionnel pour les apps mobiles, NextJS doit utiliser le cookie
            user: {
                user_id: user.user_id,
                name: user.full_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la connexion."
        });
    }
};



exports.signin = async (req, res) => {
    try {
        const { fullName, email, organizationName, password } = req.body;

        if (!fullName || !email || !organizationName || !password) {
            return res.status(400).json({ success: false, message: "Tous les champs obligatoires doivent être remplis." });
        }

        // Appliquer la politique de mot de passe fort
        const errors = pm.validate(password.trim(), { errors: true });
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: errors[0].message
            });
        }

        let user = await userService.findByEmail(email);

        if (!user) {
            const hashed = await bcrypt.hash(password.trim(), process.env.SALT_ROUNDS);
            const clef = crypto.randomUUID(); // Génération d'une clef unique

            // --- NOUVEAU: GÉNÉRATION DU TOKEN DE VÉRIFICATION ---
            const verificationToken = crypto.randomBytes(32).toString('hex');

            const orgData = { name: organizationName };
            const userData = {
                clef: clef,
                full_name: fullName,
                email: email,
                password_hash: hashed,
                role: "ORG_ADMIN",
                is_verified: false,
                verification_token: verificationToken
            };

            const result = await userService.createOrgAndAdminUser(orgData, userData);

            // Envoi de l'e-mail simulé
            await emailService.sendVerificationEmail(email, fullName, verificationToken);

            return res.status(201).json({
                success: true,
                message: "Inscription réussie ! Un e-mail de confirmation vous a été envoyé. Veuillez vérifier votre boîte de réception pour activer votre compte.",
            });
        } else {
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
            where: { verification_token: token }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "Lien de vérification invalide ou expiré." });
        }

        // Valider l'utilisateur
        await prisma.userQ.update({
            where: { user_id: user.user_id },
            data: {
                is_verified: true,
                verification_token: null // Nettoyer le token une fois utilisé
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

        return res.status(200).json({
            success: true,
            user: fullUser
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

    return res.status(200).json({
        success: true,
        message: "Déconnexion réussie."
    });
};
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { fullName, email } = req.body;

        if (!fullName || !email) {
            return res.status(400).json({ success: false, message: "Nom et email requis." });
        }

        // Vérifier si l'email est déjà utilisé par un autre utilisateur
        const existing = await userService.findByEmail(email);
        if (existing && existing.user_id !== userId) {
            return res.status(400).json({ success: false, message: "Cet email est déjà utilisé." });
        }

        const updated = await userService.updateUser(userId, {
            full_name: fullName,
            email: email
        });

        return res.status(200).json({
            success: true,
            message: "Profil mis à jour avec succès.",
            user: {
                user_id: updated.user_id,
                name: updated.full_name,
                email: updated.email
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

        const errors = pm.validate(newPassword.trim(), { errors: true });
        if (errors) {
            return res.status(400).json({ success: false, message: errors[0] });
        }

        const hashed = await bcrypt.hash(newPassword.trim(), process.env.SALT_ROUNDS);
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
