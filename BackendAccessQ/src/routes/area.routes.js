const express = require('express');
const router = express.Router();
const areaController = require('../controllers/api.area.controller');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Protect all event routes
router.use(authMiddleware);

// Seuls les admins peuvent gérer les zones
const adminOnly = roleMiddleware(["ORG_ADMIN"]);

router.get('/', areaController.getAreas);
router.get('/:id', areaController.getAreaById);
router.post('/', adminOnly, areaController.createArea);
router.put('/:id', adminOnly, areaController.updateArea);
router.delete('/:id', adminOnly, areaController.deleteArea);

module.exports = router;
