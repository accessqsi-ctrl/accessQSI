const jwt = require("jsonwebtoken");
const fs = require("fs");
const publicKey = fs.readFileSync(process.env.PUBLIC_KEY);

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const tokenFromHeader = authHeader && authHeader.split(" ")[1];
  const token = tokenFromHeader || req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Accès refusé. Token manquant." });
  }

  jwt.verify(token, publicKey, { algorithms: ["RS256"] }, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
