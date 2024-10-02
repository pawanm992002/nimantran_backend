const router = require("express").Router();
const { authenticateJWT } = require("../middleware/auth");
const {
  generateQR,
  individualWhatsuppPersonalInvite,
  bulkWhatsuppPersonalInvite,
  individualWhatsuppBusinessInvite,
  bulkWhatsuppBusinessInvite,
  fetchWhatsappInvitations,
} = require("../controllers/whatsappController");

// send message to individual by business number
router.post("/individual", authenticateJWT, individualWhatsuppBusinessInvite);

// send message to all by business number
router.post("/individual", authenticateJWT, bulkWhatsuppBusinessInvite);

// generate whatsapp qr for personal use
router.get("/generate-qr", authenticateJWT, generateQR);

// send message to individual by personal number
router.post(
  "/individualPersonal",
  authenticateJWT,
  individualWhatsuppPersonalInvite
);

// send message to all by personal number
router.get("/allPersonal", authenticateJWT, bulkWhatsuppPersonalInvite);

// get all detail of whatsupp invitations
router.get("/all", authenticateJWT, fetchWhatsappInvitations);


module.exports = router;
