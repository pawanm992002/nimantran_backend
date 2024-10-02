const express = require("express");
const router = express.Router();
const { createEvent, getAllEvents, updatedEvent, deleteEvent, getAllClientEvents, getEvent, getAllGuestMedia } = require("../controllers/eventController");
const { authenticateJWT, roleMiddleware } = require("../middleware/auth");

router.post('/create-event/:customerId', authenticateJWT, createEvent);
router.get('/get-all-events', authenticateJWT, getAllEvents);
router.get('/get-event/:id', authenticateJWT, getEvent);
router.put('/update-event/:id/:customerId', authenticateJWT, roleMiddleware(["client", 'customer']), updatedEvent)
router.delete('/delete-event/:id/:customerId', authenticateJWT, roleMiddleware(["client", 'customer']), deleteEvent)
router.get('/get-all-guest-media/:id', authenticateJWT, getAllGuestMedia)

router.get(
    "/clientEvents",
    authenticateJWT,
    getAllClientEvents
)

module.exports = router;