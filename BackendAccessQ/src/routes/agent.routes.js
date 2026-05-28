const express = require("express");
const router = express.Router();
const agentController = require("../controllers/api.agent.controller");
const roleMiddleware = require("../middleware/roleMiddleware");

// Protect all event routes
router.use(authMiddleware);

// Seuls les admins peuvent gérer les agents
const adminOnly = roleMiddleware(["SUPER_ADMIN", "ORG_ADMIN"]);

// Liste des agents
router.get("/", agentController.getAgents);

// Ajout d'un agent
router.post("/add-agent", adminOnly, agentController.addAgent);

// Activation/Désactivation d'un agent
router.put("/:id/toggle", adminOnly, agentController.toggleAgentStatus);

// Suppression d'un agent
router.delete("/:id", adminOnly, agentController.deleteAgent);

module.exports = router;
