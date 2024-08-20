const bcrypt = require("bcryptjs");
const { User, Request } = require("../models/User");
const createTransaction = require("../utility/creditTransiction");

const getClient = async (req, res) => {
  try {
    const { _id } = req.user;
    const clientInfo = await User.findById(_id)
      .populate({
        path: "customers",
        select: "-password -__v -customers",
      })
      .select("-password -__v");

    res.status(200).json({
      message: "",
      data: clientInfo,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, data: null });
  }
};

const createCustomer = async (req, res) => {
  const { name, mobile, password, email, gender, dateOfBirth, location } =
    req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const customer = new User({
      mobile,
      password: hashedPassword,
      role: "customer",
      clientId: req?.user._id,
      name,
      email,
      gender,
      dateOfBirth,
      location,
    });

    const newCustomer = await customer.save();
    if (!newCustomer) throw new Error("customer not created");

    const updateClientCustomers = await User.findByIdAndUpdate(req?.user?._id, {
      $push: { customers: newCustomer._id },
    });

    if (!updateClientCustomers) throw new Error("Customer base not updated");

    res.status(201).json({ message: "Customer created", data: newCustomer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//transfer credit to customer
const transferCredit = async (req, res) => {
  const { customerId, credits } = req.body;
  try {
    const customer = await User.findOne({
      _id: customerId,
      clientId: req.user._id,
    });

    if (!customer) throw new Error("Customer not found");

    const client = await User.findById(req.user._id);

    if (client.credits < credits) throw new Error("Insufficient credits");

    client.credits -= credits;
    customer.credits += credits;

    await client.save();

    await customer.save();

    // Create credit transaction for customer
    const Transaction = await createTransaction(
      "transfer",
      req.user._id,
      customerId,
      credits,
      "completed",
      null
    );

    if (!Transaction) throw new Error("Failed to create credit transaction");

    res.status(200).json({ message: "Credits transferred" });
  } catch (error) {
    res.status(400).json(error.message);
  }
};

const purchaseRequestFromAdmin = async (req, res) => {
  try {
    const { credits } = req.body;
    const { _id } = req.user;
    const adminId = "668bd782a46a328e5d0692c9";

    // Find client and admin
    const client = await User.findById(_id);
    const admin = await User.findById(adminId);

    if (!client || !admin) {
      throw new Error("Client or Admin not found");
    }

    if (client.role !== "client") {
      throw new Error("Only clients can send requests to admins");
    }

    if (admin.role !== "admin") {
      throw new Error("Requests can only be sent to admins");
    }

    // Create the request
    const request = new Request({
      user: _id,
      credits,
      status: "pending",
    });
    await request.save();

    // Update client and admin documents
    await client.updateOne({ $push: { sendRequests: adminId } });
    await admin.updateOne({ $push: { receiveRequests: _id } });

    return res.status(200).json({ message: "Request sent successfully" });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const getRequests = async (req, res) => {
  const user = req.user._id;

  const requests = await Request.find({ user }).populate("user", {
    name: 1,
    _id: 1,
  });

  if (!requests) {
    return res.status(401).json({
      message: "no requests",
    });
  }

  return res.status(200).json({
    data: requests,
    message: "requests fetched successfully",
  });
};

const getCustomerRequests = async (req, res) => {
  try {
    const user = req.user._id;

    const requests = await User.findById(user).select("receiveRequests");

    const respData = await Promise.all(requests?.receiveRequests?.map((requestId) => {
      return Request.find({user: requestId}).populate({path:"user", select: "name mobile"});
    }))

    if (!requests) throw new Error("there are no Requests.");

    return res.status(200).json({
      data: respData.flat(),
      message: "requests fetched successfully",
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
      data: null,
    });
  }
};

module.exports = {
  getClient,
  createCustomer,
  transferCredit,
  purchaseRequestFromAdmin,
  getRequests,
  getCustomerRequests,
};
