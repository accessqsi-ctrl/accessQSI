const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const controller = require("../controllers/api.registration.controller");
const ticketPaymentController = require("../controllers/api.ticket_payment.controller");
const authenticateAttendee = require("../middleware/attendeeAuthMiddleware");
const { publicRegistrationLimiter, registrationRecoveryLimiter } = require("../middleware/limMiddleware");
const { requireRegistrationForms: enabled } = require("../middleware/featureMiddleware");

// REGISTRATION_FORMS_ENABLED coupe la création, la gestion et la vente de formulaires.
// Ce qui est déjà vendu ou émis reste accessible : solde, reversements et liens d'accès aux pass.

const privateRouter = express.Router();
privateRouter.use(authMiddleware, roleMiddleware(["ORG_ADMIN", "SUPER_ADMIN"]));
privateRouter.get("/", enabled, controller.listForms);
const organizationAdminOnly = roleMiddleware(["ORG_ADMIN"]);
privateRouter.get("/balance", organizationAdminOnly, ticketPaymentController.balance);
privateRouter.get("/payouts", organizationAdminOnly, ticketPaymentController.payouts);
privateRouter.get("/payouts/providers", organizationAdminOnly, ticketPaymentController.payoutProviders);
privateRouter.put("/payouts/accounts", organizationAdminOnly, ticketPaymentController.setPayoutAccount);
privateRouter.post("/payouts", organizationAdminOnly, ticketPaymentController.requestPayout);
privateRouter.post("/payouts/:payoutId/cancel", organizationAdminOnly, ticketPaymentController.cancelPayout);
privateRouter.post("/", enabled, controller.createForm);
privateRouter.get("/:id", enabled, controller.getForm);
privateRouter.put("/:id", enabled, controller.updateForm);
privateRouter.put("/:id/status", enabled, controller.setStatus);
privateRouter.get("/:id/registrations", enabled, controller.listRegistrations);
privateRouter.post("/:id/registrations/:registrationId/retry-issuance", enabled, controller.retryIssuance);
privateRouter.post("/:id/registrations/:registrationId/retry-email", enabled, controller.retryEmail);

const publicRouter = express.Router();
publicRouter.use((req, res, next) => {
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    next();
});
publicRouter.get("/forms/:slug", enabled, controller.getPublicForm);
publicRouter.post("/forms/:slug/submit", enabled, publicRegistrationLimiter, authenticateAttendee, controller.submit);
publicRouter.get("/forms/:slug/offers/:offerId/providers", enabled, ticketPaymentController.providers);
publicRouter.post("/forms/:slug/checkout", enabled, publicRegistrationLimiter, authenticateAttendee, ticketPaymentController.checkout);
publicRouter.get("/access/status", controller.status);
publicRouter.get("/access/download", controller.download);
publicRouter.post("/recover", enabled, registrationRecoveryLimiter, controller.recover);

module.exports = { privateRouter, publicRouter };
