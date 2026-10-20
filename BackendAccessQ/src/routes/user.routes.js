const express = require('express');
const router = express.Router();
const { loginLimiter, signinLimiter, refreshLimiter, verificationEmailLimiter, passwordResetLimiter } = require('../middleware/limMiddleware');

router.use(express.urlencoded({ extended: true }));
router.use(express.static("public"));
const authController = require("../controllers/api.auth.controller");
const userController = require("../controllers/api.user.controller");
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const adminOnly = roleMiddleware(["ORG_ADMIN", "SUPER_ADMIN"]);


// === Authentication Routes ===
// Login submit
router.post("/login", loginLimiter, authController.login);

// Refresh access token from HttpOnly refresh token
router.post("/refresh", refreshLimiter, authController.refreshSession);

// SignIn submit
router.post('/signin', signinLimiter, authController.signin);

// VÉRIFICATION EMAIL
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", verificationEmailLimiter, authController.resendVerificationEmail);
router.post("/forgot-password", passwordResetLimiter, authController.forgotPassword);
router.post("/reset-password", passwordResetLimiter, authController.resetPassword);


// Page profile
router.get("/profile", authMiddleware, userController.viewprofile);
// User Settings
router.put("/profile", authMiddleware, userController.updateProfile);
router.put("/password", authMiddleware, userController.updatePassword);
router.get("/org", authMiddleware, adminOnly, userController.getOrganization);
router.put("/org", authMiddleware, adminOnly, userController.updateOrganization);
router.delete("/org", authMiddleware, adminOnly, userController.deleteOrganization);

// Page log out
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;
