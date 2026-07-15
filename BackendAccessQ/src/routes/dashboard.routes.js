const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/api.dashboard.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Protect all dashboard routes
router.use(authMiddleware);

// GET /api/dashboard/stats
router.get('/stats', dashboardController.getOverviewStats);
router.get('/onboarding', dashboardController.getOnboardingProgress);

module.exports = router;
