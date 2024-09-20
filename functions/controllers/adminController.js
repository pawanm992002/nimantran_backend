const jwt = require("jsonwebtoken");
const { User, Request } = require("../models/User");
const bcrypt = require("bcryptjs");
const createTransaction = require("../utility/creditTransiction");

const loginAdmin = async (req, res) => {
  try {
    const _id = "668bd782a46a328e5d0692c9";
    const { mobile, password } = req.body;
    const user = await User.findById(_id);
    if (mobile === "0000000000" && password === "0000000000") {
      const token = jwt.sign(
        {
          _id: user._id,
          mobile: user.mobile,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.status(200).json({
        data: {
          _id: user._id,
          mobile: user.mobile,
          role: user.role,
          token: token,
        },
      });
    } else {
      return res.status(400).json({
        data: "mobile or Password is Wrong",
      });
    }
  } catch (error) {
    res.status(400).json({
      data: "Something went wrong",
    });
  }
};

const acceptCreditRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await Request.findById(requestId);
    const adminId = req.user._id;
    if (!request) {
      throw new Error("Request not found");
    }

    const clientId = request.By;

    const user = await User.findById(clientId);
    if (!user) {
      throw new Error("User not found");
    }

    user.credits += request.credits;
    await user.save();

    request.status = "completed";
    await request.save();

    const Transaction = await createTransaction(
      "transfer",
      adminId,
      request.By,
      request.credits,
      "completed",
      null,
      null
    );

    if (!Transaction) throw new Error("Failed to create credit transaction");

    res.status(200).json({
      message: "Request accepted successfully",
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getRequests = async (req, res) => {
  try {
    const requests = await Request.find({To:req.user._id}).populate("By", "name");
    res.status(200).json({
      message: "All requests fetched successfully",
      data: requests,
      success: true,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    if (req?.user?.mobile != "0000000000") {
      return res.status(400).json({ msg: "you are not admin", data: null });
    }
    const users = await User.find({role: ['client', 'customer']}).select("-password -__v").populate("clientId");

    if (!users) {
      return new Error("No users are found");
    }

    res.status(200).json({ msg: "", data: users });
    return;
  } catch (error) {
    res.status(500).json({ msg: "Something Went wrong", data: null });
    return;
  }
};

const createClient = async (req, res) => {
  const { name, mobile, password, email } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const client = new User({
      name,
      email,
      mobile,
      password: hashedPassword,
      role: "client",
      credits: 0,
    });

    await client.save();

    res.status(201).json({
      message: "Client Create successfully",
      flag: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, flag: false });
  }
};

const rejectCreditRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await Request.findById(requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    const clientId = request.By;

    const user = await User.findById(clientId);
    if (!user) {
      throw new Error("User not found");
    }

    request.status = "rejected";
    await request.save();

    res.status(200).json({
      message: "Request rejected successfully",
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const transferCreditToClient = async (req, res) => {
  try {
    const {userId, credits} = req.body;

    if(credits <= 0) throw new Error("Credit must be more than zero");

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.credits += credits;
    await user.save();

    const Transaction = await createTransaction(
      "transfer",
      req.user._id,
      userId,
      credits,
      "completed",
      null,
      null
    );

    if (!Transaction) throw new Error("Failed to create credit transaction");

    res.status(200).json({
      message: "Transfer Successfull",
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  loginAdmin,
  getAllUsers,
  createClient,
  getRequests,
  acceptCreditRequest,
  rejectCreditRequest,
  transferCreditToClient,
};
