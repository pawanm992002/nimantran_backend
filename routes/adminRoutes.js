const router = require("express").Router();
const {authenticateJWT, roleMiddleware} = require('../middleware/auth');
const { loginAdmin, getAllUsers, createClient, getRequests, acceptCreditRequest, rejectCreditRequest, transferCreditToClient } = require("../controllers/adminController");

//login admin
router.post("/login", loginAdmin);

// gell all users
router.get("/getAllUsers", authenticateJWT, roleMiddleware(['admin']), getAllUsers);

router.get("/getAllRequest",authenticateJWT, roleMiddleware(['admin']),getRequests);
router.get("/acceptCreditRequest/:requestId",authenticateJWT,acceptCreditRequest);
router.get("/rejectCreditRequest/:requestId",authenticateJWT,rejectCreditRequest);
router.post(
  "/transfer-credits-to-client",
  authenticateJWT,
  roleMiddleware(["admin"]),
  transferCreditToClient
);

// Admin - Create Client
router.post(
  "/create-client",
  authenticateJWT,
  roleMiddleware(["admin"]),
  createClient
);

module.exports = router;
