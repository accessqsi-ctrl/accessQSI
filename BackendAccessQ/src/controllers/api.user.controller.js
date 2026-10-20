const bcrypt = require("bcrypt");
const userService = require("../services/user.service");
const prisma = require("../prisma/client");
const { getPlanSummary, getPlanUsage } = require("../config/subscription");
const {
    pm,
    passwordPolicyMessage,
    BCRYPT_SALT_ROUNDS,
    clearSessionCookies
} = require("../utils/account");

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
        await userService.updateUser(userId, { password_hash: hashed, session_version: { increment: 1 } });
        clearSessionCookies(res);

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
