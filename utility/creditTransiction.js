const CreditTransaction = require("../models/Credits");
const { User } = require("../models/User");

const createTransaction = async (
  areaOfUse,
  senderId,
  recieverId,
  amount,
  status,
  eventId,
  customerId
) => {
  try {
    // Validate required fields

    if (
      !areaOfUse ||
      !["video", "image", "pdf", "transfer"].includes(areaOfUse)
    ) {
      throw new Error("Invalid area of use");
    }
    if (!senderId || !amount) {
      throw new Error("Missing required fields");
    }

    if (!status || !["pending", "rejected", "completed"].includes(status)) {
      throw new Error("Missing status of transaction");
    }

    const client = await User.findById(senderId);
    if (!client) throw new Error("Client not found");

    const clientCredit = parseFloat(client.credits) - parseFloat(amount);
    if (clientCredit < 0) throw new Error("Insufficient credits");

    // Create a new transaction
    const transaction = new CreditTransaction({
      areaOfUse,
      senderId,
      recieverId,
      eventId,
      amount,
      status,
      transactionDate: new Date(),
      customerId
    });

    // Save the transaction to the database
    const res1 = await transaction.save();
    if (!res1) throw new Error("credit history not created");

    const res2 = await User.updateOne(
      { _id: senderId },
      {
        $inc: { credits: -amount },
      }
    );
    if (!res2) throw new Error("Credits not cut");

    // Return the saved transaction
    return transaction;
  } catch (error) {
    throw error;
  }
};

module.exports = createTransaction;
