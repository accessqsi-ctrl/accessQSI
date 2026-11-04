// Authentifie un participant (box). Les jetons des membres d'organisation sont refusés ici, et inversement.
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const { getPublicKey } = require("../config/jwtKeys");
const { ACCESS_COOKIE, resolveSessionAttendee } = require("../services/attendee_auth.service");

const deny = (req, res, reason) => {
    logger.warn("attendee_auth.denied", { reason, request_id: req.requestId, method: req.method, path: req.originalUrl || req.url });
    return res.status(401).json({ success: false, code: "ATTENDEE_AUTH_REQUIRED", message: "Connectez-vous à votre box." });
};

async function authenticateAttendee(req, res, next) {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) return deny(req, res, "missing_token");
    let decoded;
    try {
        decoded = jwt.verify(token, getPublicKey(), { algorithms: ["RS256"] });
    } catch {
        return deny(req, res, "invalid_token");
    }
    if (decoded.token_type !== "attendee_access") return deny(req, res, "wrong_token_type");
    try {
        const attendee = await resolveSessionAttendee(decoded);
        if (!attendee) return deny(req, res, "session_revoked");
        req.attendee = attendee;
        return next();
    } catch (error) {
        logger.error("attendee_auth.state_check_failed", { request_id: req.requestId, error });
        return res.status(503).json({ success: false, code: "AUTH_STATE_UNAVAILABLE", message: "Impossible de vérifier la session pour le moment." });
    }
}

module.exports = authenticateAttendee;
