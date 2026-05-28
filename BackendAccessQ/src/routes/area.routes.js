const express = require('express');
const router = express.Router();
const areaController = require('../controllers/api.area.controller');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const adminOnly = roleMiddleware(["SUPER_ADMIN", "ORG_ADMIN"]);

router.get('/', authMiddleware, areaController.getAreas);
router.get('/:id', authMiddleware, areaController.getAreaById);
router.post('/', adminOnly, areaController.createArea);
router.put('/:id', adminOnly, areaController.updateArea);
router.delete('/:id', adminOnly, areaController.deleteArea);

module.exports = router;
