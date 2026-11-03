const express = require("express");
const controller = require("../controllers/api.attendee.controller");
const ticketPaymentController = require("../controllers/api.ticket_payment.controller");
const authenticateAttendee = require("../middleware/attendeeAuthMiddleware");
const { attendeeCodeRequestLimiter, attendeeLoginLimiter, refreshLimiter } = require("../middleware/limMiddleware");

const noStore = (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
};

// Compte participant : /attendee
const accountRouter = express.Router();
accountRouter.use(noStore);
accountRouter.post("/code/request", attendeeCodeRequestLimiter, controller.requestCode);
accountRouter.post("/code/verify", attendeeLoginLimiter, controller.verifyCode);
accountRouter.post("/login", attendeeLoginLimiter, controller.login);
accountRouter.post("/refresh", refreshLimiter, controller.refresh);
accountRouter.post("/logout", controller.logout);
accountRouter.get("/me", authenticateAttendee, controller.me);
accountRouter.put("/password", attendeeLoginLimiter, authenticateAttendee, controller.setPassword);

// Billets du participant : /box
const boxRouter = express.Router();
boxRouter.use(noStore, authenticateAttendee);
boxRouter.get("/tickets", controller.listTickets);
boxRouter.get("/tickets/:id", controller.getTicket);
boxRouter.get("/tickets/:id/qr", controller.ticketQr);
boxRouter.get("/tickets/:id/pdf", controller.ticketPdf);
boxRouter.get("/payments/:id", ticketPaymentController.status);

module.exports = { accountRouter, boxRouter };
