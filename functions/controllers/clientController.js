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
    if (credits <= 0) {
      throw new Error("Credits must be a positive number");
    }

    await createTransaction(
      "transfer",
      req.user._id,
      customerId,
      credits,
      "completed",
      null,
      null
    );

    const customer = await User.findOne({
      _id: customerId,
      clientId: req.user._id,
    });
    if (!customer) throw new Error("Customer not found");

    customer.credits += parseFloat(credits);
    await customer.save();

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
      By: _id,
      To: adminId,
      credits,
      status: "pending",
    });
    await request.save();

    return res.status(200).json({ message: "Request sent successfully" });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const getRequests = async (req, res) => {
  const user = req.user._id;

  const requests = await Request.find({ By: user }).populate("To", {
    name: 1,
    // _id: 1,
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

    const requests = await Request.find({ To: user }).populate({
      path: "By",
      select: "name mobile",
    });

    console.log(requests);
    if (!requests) throw new Error("there are no Requests.");

    return res.status(200).json({
      data: requests,
      message: "requests fetched successfully",
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
      data: null,
    });
  }
};

const acceptCustomerCreditRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await Request.findById(requestId);
    const clientId = req.user._id;

    if (!request) {
      throw new Error("Request not found");
    }

    const customerId = request.By;
    const user = await User.findById(customerId);
    if (!user) {
      throw new Error("User not found");
    }

    await createTransaction(
      "transfer",
      clientId,
      customerId,
      request.credits,
      "completed",
      null,
      null
    );

    user.credits += request.credits;
    await user.save();

    request.status = "completed";
    await request.save();

    res.status(200).json({
      message: "Request accepted successfully",
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const rejectCustomerCreditRequest = async (req, res) => {
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

const getClientCustomers = async (req, res) => {
  try {
    const clientId = req.user._id;
    // Check if client ID is present
    if (!clientId) {
      return res.status(404).json({
        message: "Client not found",
      });
    }
    // Find the client in the database
    const client = await User.findOne({ _id: clientId });
    // Check if the client exists
    if (!client) {
      return res.status(404).json({
        message: "Client not found in database",
      });
    }
    // Convert customer IDs to strings
    const customerIds = client.customers.map((customerId) =>
      customerId.toString()
    );

    // Check if there are customer IDs
    if (!customerIds.length) {
      return res.status(404).json({
        message: "No customers associated with client",
      });
    }
    // Find customers in the database
    const customers = await User.find({ _id: { $in: customerIds } });
    // Check if customers were found
    if (!customers.length) {
      return res.status(404).json({
        message: "Customers not found in database",
      });
    }
    // Extract customer names
    const customerNamesAndId = customers.map((customer) => ({
      name: customer.name,
      id: customer._id,
    }));

    return res.status(200).json({
      customerNamesAndId,
      message: "Client customers fetched successfully",
    });
  } catch (error) {
    return res.status(500).json({
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
  acceptCustomerCreditRequest,
  rejectCustomerCreditRequest,
  getClientCustomers,
};
