const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Request } = require("../models/User");

//get user info
const getUser = async (req, res) => {
  try {
    const { _id } = req.user;
    const userInfo = await User.findById(_id)
      .populate({
        path: "customers",
        select: "-password -__v -customers",
      })
      .select("-password -__v");

    res.status(200).json({
      message: "",
      data: userInfo,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, data: null });
  }
};

//register new User
const registerUser = async (req, res) => {
  const { mobile, password, role, clientId, name } = req.body;

  if (!mobile || !password || !role || !name) {
    return res
      .status(400)
      .json({ message: "Please Enter all Requiered Details" });
  }

  if (role === "customer" && !clientId) {
    return res
      .status(400)
      .json({ message: "Client ID is required for customer registration" });
  }

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      mobile,
      password: hashedPassword,
      role,
      clientId: role === "customer" ? clientId : null,
      customers: [],
      name,
    });

    // Save new user to the database
    await newUser.save();

    res.status(200).json({ message: `${role} registered successfully` });
  } catch (error) {
    console.error("Error registering user:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "Something went wrong. Please try again later." });
  }
};

//login user
const loginUser = async (req, res) => {
  try {
    const { mobile, password } = req.body;

    const user = await User.findOne({ mobile }).select("-__v");

    if (!user) throw new Error("Invalid credentials");

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) throw new Error("Invalid credentials");

    const token = jwt.sign(
      {
        _id: user._id,
        mobile: user.mobile,
        credits: user.credits,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login Successfully",
      data: {
        _id: user._id,
        mobile: user.mobile,
        credits: user.credits,
        role: user.role,
        token: token,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

//Purchase Credits from client
const purchaseRequestFromClient = async (req, res) => {
  const { credits } = req.body;

  try {
    const customer = await User.findById(req.user._id);
    const client = await User.findById(customer.clientId);

    if (!customer || !client) {
      throw new Error("Customer or Client not found");
    }

    if (customer.role !== "customer") {
      throw new Error("Only customers can send requests to clients");
    }

    if (client.role !== "client") {
      throw new Error("Requests can only be sent to clients");
    }

    const request = new Request({
      By: req.user._id,
      To: customer.clientId,
      credits,
      status: "pending",
    });

    await request.save();

    res.status(200).json({ message: "Request sent successfully", data: request });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getUser,
  registerUser,
  loginUser,
  purchaseRequestFromClient,
};
