const express = require("express");
const router = express.Router();
const exportController = require("../controllers/api.export.controller");
const authMiddleware = require("../middleware/authMiddleware");
const { requirePlanCapability } = require("../middleware/planAccessMiddleware");
const { PLAN_CAPABILITIES } = require("../config/subscription");


// All export routes protected by authentication
router.use(authMiddleware);

const requireScanExports = requirePlanCapability(PLAN_CAPABILITIES.SCAN_EXPORTS, {
    message: "L’export des scans nécessite un abonnement Essential ou Pro."
});

router.get("/csv", requireScanExports, exportController.exportScansCSV);
router.get("/pdf", requireScanExports, exportController.exportScansPDF);

module.exports = router;
