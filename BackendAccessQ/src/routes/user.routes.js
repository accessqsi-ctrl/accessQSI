const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

router.use(express.urlencoded({ extended: true }));
router.use(express.static("public"));
const userController = require("../controllers/api.user.controller");
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const adminOnly = roleMiddleware(["SUPER_ADMIN", "ORG_ADMIN"]);

// =========================================================
// PROTECTION CONTRE LES ATTAQUES PAR FORCE BRUTE (Brute Force)
// =========================================================
// express-rate-limit est utilisé ici pour limiter le nombre de requêtes
// qu'une même adresse IP peut envoyer vers nos routes d'authentification.
// Cela empêche les robots de tester des milliers de mots de passe à la seconde.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Fenêtre de temps: 15 minutes
    max: 10, // Limite: 10 tentatives maximum par adresse IP durant les 15 minutes
    message: { success: false, message: "Trop de tentatives de connexion, veuillez réessayer après 15 minutes." },
    standardHeaders: true, // Renvoie les infos de limite dans les headers standards `RateLimit-*`
    legacyHeaders: false, // Désactive les anciens headers `X-RateLimit-*`
    validate: { xForwardedForHeader: false }, // trust proxy est déjà configuré dans app.js
});

// === Authentication Routes ===
// Login submit
router.post("/login", loginLimiter, userController.login);

// SignIn submit
router.post('/signin', userController.signin);

// VÉRIFICATION EMAIL
router.post("/verify-email", userController.verifyEmail);


// Page profile
router.get("/profile", authMiddleware, userController.viewprofile);
// User Settings
router.put("/profile", authMiddleware, userController.updateProfile);
router.put("/password", authMiddleware, userController.updatePassword);
router.get("/org", adminOnly, userController.getOrganization);
router.put("/org", adminOnly, userController.updateOrganization);
router.delete("/org", adminOnly, userController.deleteOrganization);

// Page log out
router.get("/logout", authMiddleware, userController.logout);




module.exports = router;