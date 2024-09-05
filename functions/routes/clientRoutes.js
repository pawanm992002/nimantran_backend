const router = require("express").Router();
const { authenticateJWT, roleMiddleware } = require("../middleware/auth");
const {
  getClient,
  createCustomer,
  transferCredit,
  purchaseRequestFromAdmin,
  getRequests,
  getCustomerRequests,
  acceptCustomerCreditRequest,
  rejectCustomerCreditRequest,
  getClientCustomers,
} = require("../controllers/clientController");

// Client - Information
router.get("/", authenticateJWT, roleMiddleware(["client"]), getClient);
router.get(
  "/client-requests",
  authenticateJWT,
  roleMiddleware(["client"]),
  getRequests
);

router.get(
  "/my-customer-requests",
  authenticateJWT,
  roleMiddleware(["client"]),
  getCustomerRequests
);

// Client - Create Customer
router.post(
  "/create-customer",
  authenticateJWT,
  roleMiddleware(["client"]),
  createCustomer
);

// Client - Transfer Credits to Customer
router.post(
  "/transfer-credits",
  authenticateJWT,
  roleMiddleware(["client"]),
  transferCredit
);

// purchase credit request from admin
router.post(
  "/purchase-request-from-admin",
  authenticateJWT,
  roleMiddleware(["client"]),
  purchaseRequestFromAdmin
);

router.get(
  "/acceptCustomerCreditRequest/:requestId",
  authenticateJWT,
  acceptCustomerCreditRequest
);
router.get(
  "/rejectCustomerCreditRequest/:requestId",
  authenticateJWT,
  rejectCustomerCreditRequest
);
router.get(
  "/clientCustomers",
  authenticateJWT,
  roleMiddleware(["client"]),
  getClientCustomers
);

module.exports = router;
