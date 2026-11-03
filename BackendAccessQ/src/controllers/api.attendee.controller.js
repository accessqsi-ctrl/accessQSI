const jwt = require("jsonwebtoken");
const attendeeAuth = require("../services/attendee_auth.service");
const boxService = require("../services/box.service");
const { getPublicKey } = require("../config/jwtKeys");
const logger = require("../utils/logger");

const handleError = (req, res, error, operation) => {
    const status = error.statusCode || 500;
    const code = error.code || "ATTENDEE_ERROR";
    const meta = { operation, request_id: req.requestId, attendee_id: req.attendee?.attendee_id, status, code };
    if (status >= 500) logger.error("attendee.request_failed", { ...meta, error });
    else logger.warn("attendee.request_rejected", { ...meta, reason: error.message });
    return res.status(status).json({
        success: false,
        code: error.statusCode ? code : "ATTENDEE_ERROR",
        message: error.statusCode ? error.message : "Erreur serveur",
        requestId: req.requestId
    });
};

const sessionResponse = (res, attendee, extra = {}) => {
    attendeeAuth.issueSession(res, attendee);
    return res.json({ success: true, attendee: attendeeAuth.serializeAttendee(attendee), ...extra });
};

exports.requestCode = async (req, res) => {
    try {
        const result = await attendeeAuth.requestLoginCode(req.body?.email);
        return res.status(202).json({ success: true, message: "Un code vous a été envoyé par email.", ...result });
    } catch (error) { return handleError(req, res, error, "request_login_code"); }
};

exports.verifyCode = async (req, res) => {
    try {
        const { attendee, created } = await attendeeAuth.verifyLoginCode(req.body || {});
        logger.info("attendee.login_succeeded", { request_id: req.requestId, attendee_id: attendee.attendee_id, method: "email_code", created });
        return sessionResponse(res, attendee, { created });
    } catch (error) { return handleError(req, res, error, "verify_login_code"); }
};

exports.login = async (req, res) => {
    try {
        const attendee = await attendeeAuth.loginWithPassword(req.body || {});
        logger.info("attendee.login_succeeded", { request_id: req.requestId, attendee_id: attendee.attendee_id, method: "password" });
        return sessionResponse(res, attendee);
    } catch (error) { return handleError(req, res, error, "login"); }
};

exports.refresh = async (req, res) => {
    const token = req.cookies?.[attendeeAuth.REFRESH_COOKIE];
    try {
        const decoded = token ? jwt.verify(token, getPublicKey(), { algorithms: ["RS256"] }) : null;
        const attendee = decoded?.token_type === "attendee_refresh" ? await attendeeAuth.resolveSessionAttendee(decoded) : null;
        if (!attendee) {
            attendeeAuth.clearSession(res);
            return res.status(401).json({ success: false, code: "ATTENDEE_AUTH_REQUIRED", message: "Session expirée. Reconnectez-vous à votre box." });
        }
        return sessionResponse(res, attendee);
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            attendeeAuth.clearSession(res);
            return res.status(401).json({ success: false, code: "ATTENDEE_AUTH_REQUIRED", message: "Session expirée. Reconnectez-vous à votre box." });
        }
        return handleError(req, res, error, "refresh");
    }
};

exports.logout = (req, res) => {
    attendeeAuth.clearSession(res);
    return res.json({ success: true });
};

exports.me = (req, res) => res.json({ success: true, attendee: attendeeAuth.serializeAttendee(req.attendee) });

exports.setPassword = async (req, res) => {
    try {
        const attendee = await attendeeAuth.setPassword(req.attendee.attendee_id, req.body || {});
        logger.info("attendee.password_set", { request_id: req.requestId, attendee_id: attendee.attendee_id, first_time: !req.attendee.password_hash });
        // La version de session peut avoir changé : la session courante est réémise.
        return sessionResponse(res, attendee, { message: "Votre box est sécurisée." });
    } catch (error) { return handleError(req, res, error, "set_password"); }
};

exports.listTickets = async (req, res) => {
    try { return res.json({ success: true, tickets: await boxService.listTickets(req.attendee.attendee_id) }); }
    catch (error) { return handleError(req, res, error, "list_tickets"); }
};

exports.getTicket = async (req, res) => {
    try { return res.json({ success: true, ticket: await boxService.getTicket(req.attendee.attendee_id, req.params.id) }); }
    catch (error) { return handleError(req, res, error, "get_ticket"); }
};

const noStore = res => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
};

exports.ticketQr = async (req, res) => {
    try {
        const { image, expiresAt } = await boxService.renderTicketQr(req.attendee.attendee_id, req.params.id);
        noStore(res);
        res.setHeader("Content-Type", "image/png");
        if (expiresAt) res.setHeader("X-Qr-Expires-At", expiresAt.toISOString());
        return res.status(200).send(image);
    } catch (error) { return handleError(req, res, error, "ticket_qr"); }
};

exports.ticketPdf = async (req, res) => {
    try {
        const buffer = await boxService.renderTicketPdf(req.attendee.attendee_id, req.params.id);
        noStore(res);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=billet-accessq.pdf");
        return res.status(200).send(buffer);
    } catch (error) { return handleError(req, res, error, "ticket_pdf"); }
};
