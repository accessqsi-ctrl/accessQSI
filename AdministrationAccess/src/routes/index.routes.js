const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const orgController = require('../controllers/organization.controller');
const userController = require('../controllers/user.controller');

// Authentification
router.get('/login', authController.renderLogin);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

// Root redirects to dashboard
router.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// Zone protégée (Nécessite d'être SUPER_ADMIN)
router.use(authController.requireAuth);

router.get('/dashboard', authController.renderDashboard);

// Organisations
router.get('/organizations', orgController.listOrganizations);
router.post('/organizations/:id/deactivate', orgController.deactivateOrganization);
router.post('/organizations/:id/activate', orgController.activateOrganization);
router.post('/organizations/:id/archive', orgController.archiveOrganization);
router.post('/organizations/:id/enterprise', orgController.activateEnterprise);

// Utilisateurs
router.get('/users', userController.listUsers);
router.post('/users/:id/deactivate', userController.deactivateUser);
router.post('/users/:id/activate', userController.activateUser);

module.exports = router;
