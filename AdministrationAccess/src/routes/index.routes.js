const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const orgController = require('../controllers/organization.controller');
const userController = require('../controllers/user.controller');
const { rateLimit } = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req, res) => res.status(429).render('login', {
        error: 'Trop de tentatives. Réessayez dans quelques minutes.',
        email: String(req.body?.email || ''),
        loginCsrf: req.cookies?.adminLoginCsrf || ''
    })
});

// Authentification
router.get('/login', authController.renderLogin);
router.post('/login', authController.requireLoginCsrf, loginLimiter, authController.login);
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

// Root redirects to dashboard
router.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// Zone protégée (Nécessite d'être SUPER_ADMIN)
router.use(authController.requireAuth);
router.use(authController.requireCsrf);

router.get('/dashboard', authController.renderDashboard);

// Organisations
router.get('/organizations', orgController.listOrganizations);
router.get('/organizations/:id', orgController.showOrganization);
router.post('/organizations/:id/deactivate', orgController.deactivateOrganization);
router.post('/organizations/:id/activate', orgController.activateOrganization);
router.post('/organizations/:id/archive', orgController.archiveOrganization);
router.post('/organizations/:id/enterprise', orgController.activateEnterprise);

// Gestion des agents depuis une organisation
router.post('/users/:id/deactivate', userController.deactivateUser);
router.post('/users/:id/activate', userController.activateUser);

module.exports = router;
