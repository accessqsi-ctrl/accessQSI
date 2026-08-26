const express = require('express');
const router = express.Router();
const { loginLimiter, signinLimiter, refreshLimiter, verificationEmailLimiter, passwordResetLimiter } = require('../middleware/limMiddleware');

router.use(express.urlencoded({ extended: true }));
router.use(express.static("public"));
const userController = require("../controllers/api.user.controller");
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const adminOnly = roleMiddleware(["ORG_ADMIN", "SUPER_ADMIN"]);


// === Authentication Routes ===
// Login submit
router.post("/login", loginLimiter, userController.login);

// Refresh access token from HttpOnly refresh token
router.post("/refresh", refreshLimiter, userController.refreshSession);

// SignIn submit
router.post('/signin', signinLimiter, userController.signin);

// VÉRIFICATION EMAIL
router.post("/verify-email", userController.verifyEmail);
router.post("/resend-verification", verificationEmailLimiter, userController.resendVerificationEmail);
router.post("/forgot-password", passwordResetLimiter, userController.forgotPassword);
router.post("/reset-password", passwordResetLimiter, userController.resetPassword);


// Page profile
router.get("/profile", authMiddleware, userController.viewprofile);
// User Settings
router.put("/profile", authMiddleware, userController.updateProfile);
router.put("/password", authMiddleware, userController.updatePassword);
router.get("/org", authMiddleware, adminOnly, userController.getOrganization);
router.put("/org", authMiddleware, adminOnly, userController.updateOrganization);
router.delete("/org", authMiddleware, adminOnly, userController.deleteOrganization);

// Page log out
router.get("/logout", authMiddleware, userController.logout);

router.get('/ip', (req, res) => {
    res.json({
        ip: req.ip,
        ips: req.ips,
        xForwardedFor: req.headers['x-forwarded-for'],
        trustProxy: req.app.get('trust proxy'),
    });
});

module.exports = router;
