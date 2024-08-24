const CreditTransaction = require("../models/Credits");

const getAllCustomerTransactions = async (req, res) => {
  try {
    const { areaOfUse, customerId } = req.query;
    let transaction = [];

    if (areaOfUse === "transfer") {
      transaction = await CreditTransaction.find({
        recieverId: customerId,
        areaOfUse: areaOfUse,
      })
        .populate("recieverId", "name");
    }

    if (['spend'].includes(areaOfUse)) {
      transaction = await CreditTransaction.find({
        customerId: customerId,
        areaOfUse: ['image', 'pdf', 'video'],
      }).populate("eventId");
    }

    return res.status(200).json(transaction);
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    return res
      .status(400)
      .json({ message: "Server error. Please try again later." });
  }
};

const getClientTransaction = async (req, res) => {
  try {
    const { _id } = req.user;
    const { areaOfUse } = req.query;
    let transaction = [];

    if (areaOfUse === "transfer") {
      transaction = await CreditTransaction.find({
        senderId: _id,
        areaOfUse: areaOfUse,
      })
        .populate("recieverId", "name");
    }

    if (['spend'].includes(areaOfUse)) {
      transaction = await CreditTransaction.find({
        senderId: _id,
        areaOfUse: ['image', 'pdf', 'video'],
      }).populate("eventId");
    }

    return res.status(200).json(transaction);
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
      success: true
    })
      
  } catch (error) {
    console.error("Error fetching transactions:", error.message);
    return res
      .status(400)
      .json({ message: "Server error. Please try again later." });
  }

}

module.exports = {
  getAllCustomerTransactions,
  getClientTransaction,
  adminTransactions
};
