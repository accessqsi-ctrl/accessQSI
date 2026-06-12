const express = require('express');
const router = express.Router();
const { loginLimiter, signinLimiter, generalLimiter } = require('../middleware/limMiddleware');

router.use(express.urlencoded({ extended: true }));
router.use(express.static("public"));
const userController = require("../controllers/api.user.controller");
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const adminOnly = roleMiddleware(["ORG_ADMIN"]);


// === Authentication Routes ===
// Login submit
router.post("/login", loginLimiter, userController.login);

// SignIn submit
router.post('/signin', signinLimiter, userController.signin);

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