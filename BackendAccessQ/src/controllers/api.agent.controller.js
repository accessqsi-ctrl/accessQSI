const bcrypt = require("bcrypt");
const crypto = require("crypto");
const agentService = require("../services/agent.service");
const emailService = require("../services/email.service");
const userService = require("../services/user.service");

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
                status: agent.deleted_at ? "Inactif" : "Actif",
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
        if (!req.user || !req.user.org_id || req.user.role !== "ORG_ADMIN") {
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

        // Utiliser le mot de passe fourni ou en générer un aléatoire sécurisé
        const rawPassword = password || (crypto.randomBytes(8).toString('hex') + "!Aa1");
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        // Déterminer le rôle à attribuer
        let assignedRole = "ORG_AGENT";
        if (role === "ORG_ADMIN") assignedRole = "ORG_ADMIN";
        else if (role === "OPERATOR") assignedRole = "OPERATOR";

        // Enregistrer l'agent
        const newAgent = await agentService.createAgent(orgId, fullName, email, hashedPassword, assignedRole);

        // Envoyer l'email avec les identifiants
        await emailService.sendAgentInvitation(email, fullName, rawPassword);

        return res.status(201).json({ success: true, message: "Agent ajouté et invitation envoyée avec succès." });
    } catch (error) {
        console.error("Erreur addAgent:", error);
        return res.status(500).json({ success: false, message: "Erreur lors de l'ajout de l'agent." });
    }
};

exports.toggleAgentStatus = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id || req.user.role !== "ORG_ADMIN") {
            return res.status(403).json({ success: false, message: "Accès refusé." });
        }

        const agentId = Number(req.params.id);
        const orgId = req.user.org_id;

        const agent = await agentService.getAgentByIdAndOrg(agentId, orgId);
        if (!agent) {
            return res.status(404).json({ success: false, message: "Agent introuvable dans votre organisation." });
        }

        if (agent.role === "ORG_ADMIN") {
            return res.status(403).json({ success: false, message: "Vous ne pouvez pas révoquer un administrateur." });
        }

        const isCurrentlyDeleted = agent.deleted_at !== null;
        await agentService.updateAgentStatus(agentId, !isCurrentlyDeleted);

        return res.status(200).json({ 
            success: true, 
            message: isCurrentlyDeleted ? "Accès restauré avec succès." : "Accès révoqué avec succès.",
            newStatus: isCurrentlyDeleted ? "Actif" : "Inactif"
        });
    } catch (error) {
        console.error("Erreur toggleAgentStatus:", error);
        return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
};

exports.deleteAgent = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id || req.user.role !== "ORG_ADMIN") {
            return res.status(403).json({ success: false, message: "Accès refusé." });
        }

        const agentId = Number(req.params.id);
        const orgId = req.user.org_id;

        const agent = await agentService.getAgentByIdAndOrg(agentId, orgId);
        if (!agent) {
            return res.status(404).json({ success: false, message: "Agent introuvable." });
        }

        if (agent.role === "ORG_ADMIN") {
            return res.status(403).json({ success: false, message: "Impossible de supprimer un administrateur." });
        }

        try {
            await agentService.hardDeleteAgent(agentId, orgId);
        } catch (dbError) {
            // Gérer la contrainte de clé étrangère (ex: si l'agent a des journaux de scan) (P2003 dans Prisma)
            if (dbError.code === 'P2003') {
                return res.status(400).json({ 
                    success: false, 
                    message: "Cet agent ne peut pas être supprimé car il possède des journaux de scan (historique). Révoquez son accès à la place." 
                });
            }
            throw dbError;
        }

        return res.status(200).json({ success: true, message: "Agent supprimé définitivement." });
    } catch (error) {
        console.error("Erreur deleteAgent:", error);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de la suppression." });
    }
};
