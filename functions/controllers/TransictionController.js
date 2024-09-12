const CreditTransaction = require("../models/Credits");
const { User } = require("../models/User");

const getAllCustomerTransactions = async (req, res) => {
  try {
    const { customerId } = req.query;
     console.log(customerId)
    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    const transactions = await CreditTransaction.find({
      $or: [
        { senderId: customerId },
        { recieverId: customerId },
        { customerId: customerId },
      ],
    })
      .populate([
        { path: "recieverId", select: "name" },
        { path: "eventId", select: "eventName" },
        { path: "senderId", select: "role" },
        { path: "customerId", select: "name" },
      ])
      .sort({ transactionDate: -1 });

    if (transactions.length === 0) {
      return res.status(404).json({ message: "No transactions found" });
    }

    const formattedTransactions = transactions.map((transaction) => ({
      _id: transaction._id,
      areaOfUse: transaction.areaOfUse,
      recieverId: transaction.recieverId,
      eventId: transaction.eventId,
      amount: transaction.amount,
      transactionDate: transaction.transactionDate,
    }));

    const credits = await User.findById(customerId).select("-_id credits");
    if (!credits) {
      return res.status(404).json({ message: "No Credits found" });
    }
    return res
      .status(200)
      .json({ transactions: formattedTransactions, credits: credits });
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    return res
      .status(400)
      .json({ message: "Server error. Please try again later." });
  }
};

const getClientTransaction = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(400).json({ message: "User not found" });
    }
    const { _id } = req.user;
    // Fetch all transactions
    const allTransactions = await CreditTransaction.find({
      $or: [{ recieverId: _id }, { senderId: _id }],
    })
      .sort({ transactionDate: -1 })
      .populate([
        { path: "recieverId", select: "name" },
        { path: "eventId", select: "eventName" },
        { path: "senderId", select: "role" },
        { path: "customerId", select: "name amount" },
      ]);

    // Use a Set to store unique transaction IDs
    if (!allTransactions?.length) {
      return res.status(400).json({ message: "Data not found" });
    }
    const uniqueTransactions = new Map();

    allTransactions.forEach((transaction) => {
      const transactionId = transaction._id.toString();
      const transactionType =
        transaction.senderId._id.toString() === _id ? "debit" : "credit";

      if (!uniqueTransactions.has(transactionId)) {
        uniqueTransactions.set(transactionId, {
          ...transaction.toObject(),
          type: transactionType,
        });
      }
    });

    const result = Array.from(uniqueTransactions.values());
    const getClientCredits = await User.findById(_id).select("credits -_id");
    console.log(getClientCredits);
    if (!getClientCredits) {
      return res.status(400).json({ message: "Client Credits not Found" });
    }

    return res
      .status(200)
      .json({ transaction: result, credits: getClientCredits });
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    return res
      .status(400)
      .json({ message: "Server error. Please try again later." });
  }
};

const adminTransactions = async (req, res) => {
  try {
    const { _id } = req.user;
    const transaction = await CreditTransaction.find({
      senderId: _id,
    }).populate("recieverId", "name");
    return res.status(200).json({
      message: "all transaction fetched successfully",
      data: transaction,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    return res
      .status(400)
      .json({ message: "Server error. Please try again later." });
  }
};

module.exports = {
  getAllCustomerTransactions,
  getClientTransaction,
  adminTransactions,
};
