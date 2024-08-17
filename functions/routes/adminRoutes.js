const router = require("express").Router();
const {authenticateJWT, roleMiddleware} = require('../middleware/auth');
const { loginAdmin, getAllClientWithCustomers, getAllUsers, createClient, getRequests, acceptCreditRequest, rejectCreditRequest } = require("../controllers/adminController");

//login admin
router.post("/login", loginAdmin);



// gell all users
router.get("/getAllUsers", authenticateJWT, getAllUsers);
router.get("/getAllRequest",authenticateJWT,getRequests);
router.get("/acceptCreditRequest/:requestId",authenticateJWT,acceptCreditRequest);
router.get("/rejectCreditRequest/:requestId",authenticateJWT,rejectCreditRequest);
// Admin - Create Client
router.post(
  "/create-client",
  authenticateJWT,
  roleMiddleware(["admin"]),
  createClient
);

module.exports = router;
