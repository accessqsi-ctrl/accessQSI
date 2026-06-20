const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const tokenFromHeader = authHeader && authHeader.split(" ")[1];
  const token = tokenFromHeader || req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Accès refusé. Token manquant." });
  }

  jwt.verify(token, process.env.PUBLIC_KEY, { algorithms: ["RS256"] }, (err, user) => {
    if (err) return res.sendStatus(403);
    if (user.token_type !== "access") return res.sendStatus(403);
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
