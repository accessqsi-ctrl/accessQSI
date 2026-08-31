const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const { getPublicKey } = require("../config/jwtKeys");
const { evaluateAccess, findUserAccessState } = require("../services/account_access.service");

const OPERATOR_ALLOWED_REQUESTS = new Set([
  "GET /user/profile",
  "PUT /user/password",
  "GET /user/logout",
  "GET /areas",
  "GET /events",
  "POST /qr/verify"
]);

function normalizePath(req) {
  const rawPath = String(req.originalUrl || req.url || "").split("?")[0];
  return rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
}

function canOperatorAccess(req) {
  return OPERATOR_ALLOWED_REQUESTS.has(`${req.method} ${normalizePath(req)}`);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const tokenFromHeader = authHeader && authHeader.split(" ")[1];
  const token = tokenFromHeader || req.cookies?.token;

  if (!token) {
    logger.warn("auth.denied", {
      reason: "missing_token",
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl || req.url
    });
    return res.status(401).json({ message: "Accès refusé. Token manquant." });
  }

  jwt.verify(token, getPublicKey(), { algorithms: ["RS256"] }, async (err, tokenUser) => {
    if (err) {
      logger.warn("auth.denied", {
        reason: "invalid_token",
        request_id: req.requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        error: err
      });
      return res.sendStatus(403);
    }
    if (tokenUser.token_type !== "access") {
      logger.warn("auth.denied", {
        reason: "wrong_token_type",
        request_id: req.requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        user_id: tokenUser.user_id,
        org_id: tokenUser.org_id
      });
      return res.sendStatus(403);
    }
    try {
      const currentUser = await findUserAccessState(tokenUser.user_id);
      const access = evaluateAccess(currentUser, tokenUser);
      if (!access.allowed) {
        logger.warn("auth.denied", {
          reason: access.code,
          request_id: req.requestId,
          user_id: tokenUser.user_id,
          org_id: tokenUser.org_id,
          method: req.method,
          path: req.originalUrl || req.url
        });
        res.clearCookie?.("token");
        res.clearCookie?.("refreshToken");
        return res.status(403).json({
          success: false,
          code: access.code,
          message: "Accès refusé. Le compte ou l’organisation n’est pas actif."
        });
      }
      req.user = {
        user_id: currentUser.user_id,
        email: currentUser.email,
        role: currentUser.role,
        org_id: currentUser.org_id,
        token_type: "access"
      };

    if (req.user.role === "OPERATOR" && !canOperatorAccess(req)) {
      logger.warn("operator.access_denied", {
        request_id: req.requestId,
        user_id: req.user.user_id,
        org_id: req.user.org_id,
        method: req.method,
        path: req.originalUrl || req.url
      });
      return res.status(403).json({
        success: false,
        message: "Accès refusé. Un opérateur peut uniquement scanner des QR codes et modifier son mot de passe."
      });
    }

      next();
    } catch (error) {
      logger.error("auth.state_check_failed", {
        error,
        request_id: req.requestId,
        user_id: tokenUser.user_id,
        org_id: tokenUser.org_id
      });
      return res.status(503).json({
        success: false,
        code: "AUTH_STATE_UNAVAILABLE",
        message: "Impossible de vérifier la session pour le moment."
      });
    }
  });
}

authenticateToken.canOperatorAccess = canOperatorAccess;

module.exports = authenticateToken;
