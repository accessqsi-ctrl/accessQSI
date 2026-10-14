const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const controller = require("../controllers/api.registration.controller");
const { publicRegistrationLimiter, registrationRecoveryLimiter } = require("../middleware/limMiddleware");

const privateRouter = express.Router();
privateRouter.use(authMiddleware, roleMiddleware(["ORG_ADMIN", "SUPER_ADMIN"]));
privateRouter.get("/", controller.listForms);
privateRouter.post("/", controller.createForm);
privateRouter.get("/:id", controller.getForm);
privateRouter.put("/:id", controller.updateForm);
privateRouter.put("/:id/status", controller.setStatus);
privateRouter.get("/:id/registrations", controller.listRegistrations);
privateRouter.post("/:id/registrations/:registrationId/retry-issuance", controller.retryIssuance);
privateRouter.post("/:id/registrations/:registrationId/retry-email", controller.retryEmail);

const publicRouter = express.Router();
publicRouter.use((req, res, next) => {
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    next();
});
publicRouter.get("/forms/:slug", controller.getPublicForm);
publicRouter.post("/forms/:slug/submit", publicRegistrationLimiter, controller.submit);
publicRouter.get("/access/status", controller.status);
publicRouter.get("/access/download", controller.download);
publicRouter.post("/recover", registrationRecoveryLimiter, controller.recover);

module.exports = { privateRouter, publicRouter };
