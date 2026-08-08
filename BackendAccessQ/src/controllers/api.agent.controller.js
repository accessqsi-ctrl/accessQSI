const bcrypt = require("bcrypt");
const crypto = require("crypto");
const agentService = require("../services/agent.service");
const emailService = require("../services/email.service");
const userService = require("../services/user.service");
const logger = require("../utils/logger");
const { withOrganizationQuota } = require("../services/organization_quota.service");

const canManageAgents = (user) => {
    return user && user.org_id && ["ORG_ADMIN", "SUPER_ADMIN"].includes(user.role);
};

exports.canManageAgents = canManageAgents;

exports.getAgents = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const agents = await agentService.getAllAgentsForOrg(orgId);

        // Formatage pour le frontend
        const formattedAgents = agents.map(agent => {
            return {
                id: agent.user_id,
                name: agent.full_name,
                email: agent.email,
                role: agent.role === "ORG_ADMIN" ? "Admin" : (agent.role === "OPERATOR" ? "Opérateur" : "Agent"),
                status: agent.suspended_by_plan ? "Suspendu par le plan" : agent.deleted_at || !agent.is_active ? "Inactif" : "Actif",
                lastActive: agent.last_login ? new Date(agent.last_login).toLocaleDateString() : (agent.created_at ? new Date(agent.created_at).toLocaleDateString() : "Jamais"),
                scans: agent._count.scan_logs
            };
        });

        return res.status(200).json({ success: true, agents: formattedAgents });
    } catch (error) {
        console.error("Erreur getAllAgents:", error);
        return res.status(500).json({ success: false, message: "Erreur serveur interne" });
    }
};

exports.addAgent = async (req, res) => {
    try {
        if (!canManageAgents(req.user)) {
            return res.status(403).json({ success: false, message: "Accès refusé. Réservé aux administrateurs." });
        }

        const orgId = req.user.org_id;
        const { fullName, email, role, password } = req.body;

        if (!fullName || !email) {
            return res.status(400).json({ success: false, message: "Le nom et l'email sont requis." });
        }

        // Vérifier si l'email existe déjà
        const existingUser = await userService.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Un utilisateur avec cet email existe déjà." });
        }

        // Déterminer le rôle à attribuer
        let assignedRole = "ORG_AGENT";
        if (role === "ORG_ADMIN") assignedRole = "ORG_ADMIN";
        else if (role === "OPERATOR") assignedRole = "OPERATOR";

        // Utiliser le mot de passe fourni ou en générer un aléatoire sécurisé
        const rawPassword = password || (crypto.randomBytes(8).toString('hex') + "!Aa1");
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        // Enregistrer l'agent
        const createAgent = (dbClient) => agentService.createAgent(
            orgId,
            fullName,
            email,
            hashedPassword,
            assignedRole,
            dbClient
        );
        const newAgent = assignedRole === "ORG_ADMIN"
            ? await createAgent()
            : await withOrganizationQuota({
                organizationId: orgId,
                limitKey: "maxAgents",
                resourceName: "d'agents",
                count: (tx) => tx.userQ.count({
                    where: {
                        org_id: orgId,
                        role: { in: ["ORG_AGENT", "OPERATOR"] },
                        deleted_at: null,
                        is_active: true
                    }
                }),
                create: createAgent
            });

        // Envoyer l'email avec les identifiants
        await emailService.sendAgentInvitation(email, fullName, rawPassword);

        logger.info("agent.created", {
            request_id: req.requestId,
            admin_id: req.user.user_id,
            org_id: orgId,
            agent_id: newAgent.user_id,
            role: assignedRole
        });

        return res.status(201).json({ success: true, message: "Agent ajouté et invitation envoyée avec succès." });
    } catch (error) {
        if (error.code === "PLAN_QUOTA_EXCEEDED") {
            return res.status(403).json({
                success: false,
                message: `Votre quota d'agents actifs est atteint (${error.currentCount}/${error.limit}). Désactivez un agent ou changez de plan.`,
                plan: error.plan,
                planName: error.planName,
                upgradeRequired: true
            });
        }
        console.error("Erreur addAgent:", error);
        return res.status(500).json({ success: false, message: "Erreur lors de l'ajout de l'agent." });
    }
};

exports.toggleAgentStatus = async (req, res) => {
    try {
        if (!canManageAgents(req.user)) {
            return res.status(403).json({ success: false, message: "Accès refusé." });
        }

        const agentId = Number(req.params.id);
        const orgId = req.user.org_id;

        if (agentId === Number(req.user.user_id)) {
            return res.status(403).json({ success: false, message: "Vous ne pouvez pas modifier votre propre accès." });
        }

        const agent = await agentService.getAgentByIdAndOrg(agentId, orgId);
        if (!agent) {
            return res.status(404).json({ success: false, message: "Agent introuvable dans votre organisation." });
        }

        if (agent.role === "ORG_ADMIN") {
            return res.status(403).json({ success: false, message: "Vous ne pouvez pas révoquer un administrateur." });
        }

        const isCurrentlyDeleted = agent.deleted_at !== null || !agent.is_active;

        if (isCurrentlyDeleted) {
            await withOrganizationQuota({
                organizationId: orgId,
                limitKey: "maxAgents",
                resourceName: "d'agents",
                count: (tx) => tx.userQ.count({
                    where: {
                        org_id: orgId,
                        role: { in: ["ORG_AGENT", "OPERATOR"] },
                        deleted_at: null,
                        is_active: true
                    }
                }),
                create: (tx) => agentService.updateAgentStatus(agentId, false, tx)
            });
        } else {
            await agentService.updateAgentStatus(agentId, true);
        }
        logger.info("agent.status_changed", {
            request_id: req.requestId,
            admin_id: req.user.user_id,
            org_id: orgId,
            agent_id: agentId,
            deleted: !isCurrentlyDeleted
        });

        return res.status(200).json({ 
            success: true, 
            message: isCurrentlyDeleted ? "Accès restauré avec succès." : "Accès révoqué avec succès.",
            newStatus: isCurrentlyDeleted ? "Actif" : "Inactif"
        });
    } catch (error) {
        if (error.code === "PLAN_QUOTA_EXCEEDED") {
            return res.status(403).json({
                success: false,
                message: `Votre quota d'agents actifs est atteint (${error.currentCount}/${error.limit}). Désactivez un autre agent ou changez de plan.`,
                plan: error.plan,
                planName: error.planName,
                upgradeRequired: true
            });
        }
        console.error("Erreur toggleAgentStatus:", error);
        return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
};

exports.deleteAgent = async (req, res) => {
    try {
        if (!canManageAgents(req.user)) {
            return res.status(403).json({ success: false, message: "Accès refusé." });
        }

        const agentId = Number(req.params.id);
        const orgId = req.user.org_id;

        if (agentId === Number(req.user.user_id)) {
            return res.status(403).json({ success: false, message: "Vous ne pouvez pas supprimer votre propre compte." });
        }

        const agent = await agentService.getAgentByIdAndOrg(agentId, orgId);
        if (!agent) {
            return res.status(404).json({ success: false, message: "Agent introuvable." });
        }

        if (agent.role === "ORG_ADMIN") {
            return res.status(403).json({ success: false, message: "Impossible de supprimer un administrateur." });
        }

        await agentService.softDeleteAgent(agentId, orgId);
        logger.info("agent.deleted", {
            request_id: req.requestId,
            admin_id: req.user.user_id,
            org_id: orgId,
            agent_id: agentId
        });

        return res.status(200).json({ success: true, message: "Agent désactivé et conservé dans l'historique." });
    } catch (error) {
        console.error("Erreur deleteAgent:", error);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de la suppression." });
    }
};
