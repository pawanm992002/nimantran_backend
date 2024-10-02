const router = require("express").Router();

const {
  getAllCustomerTransactions,
  getClientTransaction,
  adminTransactions,
} = require("../controllers/TransictionController");
const { authenticateJWT, roleMiddleware } = require("../middleware/auth");

router.get(
  "/get-transictions",
  authenticateJWT,
  getAllCustomerTransactions
);

// get credit history of client
router.get(
  "/get-client-transaction",
  authenticateJWT,
  roleMiddleware(["client"]),
  getClientTransaction
);

//get admin transaction 

router.get(
  "/get-admin-transaction",
  authenticateJWT,
  roleMiddleware(["admin"]),
  adminTransactions
);
module.exports = router;
