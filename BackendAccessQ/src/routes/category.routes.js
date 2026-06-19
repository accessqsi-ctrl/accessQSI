const express = require('express');
const router = express.Router();
const catController = require("../controllers/api.category.controller");
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const adminOnly = roleMiddleware(["ORG_ADMIN", "SUPER_ADMIN"]);

router.use(authMiddleware)
// list categories
router.get("/cats", adminOnly, catController.renderCats);


// create cat
router.post("/createCat", adminOnly, catController.createCat);


// delete cat
router.delete("/deleteCat/:id", adminOnly, catController.deletecat);

module.exports = router;
