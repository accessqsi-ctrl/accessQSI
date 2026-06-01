const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
    windowMs: 5000,
    max: 3,
    message: "Trop de requêtes, veuillez réessayer plus tard"
});

module.exports = limiter;
