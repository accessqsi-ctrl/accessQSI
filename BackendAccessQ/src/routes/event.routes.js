const express = require('express');
const router = express.Router();
const eventController = require('../controllers/api.event.controller');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Protect all event routes
router.use(authMiddleware);

// Define admin roles
const adminOnly = roleMiddleware(["ORG_ADMIN"]);

// GET /events (Get all events for user's org)
router.get("/", eventController.getEvents);

// GET /events/:eventId (Get specific event details)
router.get("/:event_id", eventController.getEventById);

// POST /events (Create new event)
router.post("/", adminOnly, eventController.createEvent);

// PUT /events/:eventId (Update event)
router.put("/:event_id", adminOnly, eventController.updateEvent);

// DELETE /events/:eventId (Soft delete)
router.delete("/:event_id", adminOnly, eventController.deleteEvent);

module.exports = router;
