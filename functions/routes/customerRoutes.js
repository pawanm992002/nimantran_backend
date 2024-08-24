const router = require("express").Router();
const {
  getCustomer,
  updateCustomer,
  searchCustomers, // Import the new function
  getRequests
} = require("../controllers/customerController");
const {
  getEvent,
  getAllCustomerEvents,
} = require("../controllers/eventController");
const { authenticateJWT, roleMiddleware } = require("../middleware/auth");

// Route to get customer information
router.get(
  "/customerInfo/:customerId",
  authenticateJWT,
  getCustomer
);

// Route to update customer information
router.put(
  "/updateCustomer/:customerId",
  authenticateJWT,
  updateCustomer
);

// Route to get all events for a customer
router.get(
  "/customerEvents/:customerId",
  authenticateJWT,
  getAllCustomerEvents
);

// Route to search customers by name
router.get(
  "/searchCustomers",
  authenticateJWT,
  searchCustomers
);

router.get(
  "/customers-requests",
  authenticateJWT,
  getRequests
);

module.exports = router;
