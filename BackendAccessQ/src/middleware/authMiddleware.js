const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

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

  jwt.verify(token, process.env.PUBLIC_KEY, { algorithms: ["RS256"] }, (err, user) => {
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
    next();
  });
}

module.exports = authenticateToken;
