const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const { getPublicKey } = require("../config/jwtKeys");

const OPERATOR_ALLOWED_REQUESTS = new Set([
  "GET /user/profile",
  "PUT /user/password",
  "GET /user/logout",
  "GET /areas",
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

  jwt.verify(token, getPublicKey(), { algorithms: ["RS256"] }, (err, user) => {
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
    if (user.token_type !== "access") {
      logger.warn("auth.denied", {
        reason: "wrong_token_type",
        request_id: req.requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        user_id: user.user_id,
        org_id: user.org_id
      });
      return res.sendStatus(403);
    }
    req.user = user;

    if (user.role === "OPERATOR" && !canOperatorAccess(req)) {
      logger.warn("operator.access_denied", {
        request_id: req.requestId,
        user_id: user.user_id,
        org_id: user.org_id,
        method: req.method,
        path: req.originalUrl || req.url
      });
      return res.status(403).json({
        success: false,
        message: "Accès refusé. Un opérateur peut uniquement scanner des QR codes et modifier son mot de passe."
      });
    }

    next();
  });
}

authenticateToken.canOperatorAccess = canOperatorAccess;

module.exports = authenticateToken;
