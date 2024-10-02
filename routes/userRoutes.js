const router = require("express").Router();
const { authenticateJWT, roleMiddleware } = require("../middleware/auth");

const {
  registerUser,
  loginUser,
  purchaseRequestFromClient,
  getUser,
} = require("../controllers/userController");

// User - Information
router.get("/", authenticateJWT, getUser);

// Register Route for client and customer
router.post("/register", registerUser);

// Login Route
router.post("/login", loginUser);

// Customer - purchase Credits from Client
router.post(
  "/purchase-request-from-client",
  authenticateJWT,
  roleMiddleware(["customer"]),
  purchaseRequestFromClient
);

module.exports = router;
