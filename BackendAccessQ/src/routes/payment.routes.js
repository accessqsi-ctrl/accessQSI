const express = require("express");
const paymentController = require("../controllers/api.payment.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();
const organizationAdminOnly = roleMiddleware(["ORG_ADMIN"]);

router.post("/callbacks/pawapay", paymentController.callback);
router.post("/callbacks/pawapay/refunds", paymentController.refundCallback);

router.use(authMiddleware);
router.get("/plans", paymentController.getPlans);
router.get("/providers", organizationAdminOnly, paymentController.getProviders);
router.get("/", organizationAdminOnly, paymentController.getOverview);
router.post("/quote", organizationAdminOnly, paymentController.getQuote);
router.post("/trial/start", organizationAdminOnly, paymentController.startTrial);
router.post("/subscription/cancel", organizationAdminOnly, paymentController.cancelSubscription);
router.delete("/subscription/change", organizationAdminOnly, paymentController.cancelChange);
router.patch("/subscription/change/resources", organizationAdminOnly, paymentController.selectRetainedResources);
router.post("/payments", organizationAdminOnly, paymentController.initiate);
router.post("/payments/:depositId/refresh", organizationAdminOnly, paymentController.refreshStatus);

module.exports = router;
