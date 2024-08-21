const { User } = require("../models/User");

const getCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await User.findById(customerId);
    res.status(200).json({
      success: true,
      message: "Customer info fetched successfully",
      data: customer,
    });
  } catch (error) {
    console.error("Error fetching customer profile:", error);
    res.status(400).json({
      error: error.message,
      message: "Error fetching customer info",
    });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { name, mobile, email, gender, dateOfBirth, location } = req.body;

    const customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    if (name) customer.name = name;
    if (mobile) customer.mobile = mobile;
    if (email) customer.email = email;
    if (gender) customer.gender = gender;
    if (dateOfBirth) customer.dateOfBirth = dateOfBirth;
    if (location) customer.location = location;

    await customer.save();

    res.status(200).json({
      data: customer,
      message: "Customer details updated successfully",
    });
  } catch (error) {
    console.error("Error updating customer profile:", error);
    res.status(500).json({
      error: error.message,
      message: "Error updating customer info",
    });
  }
};

const searchCustomers = async (req, res) => {
  try {
    const { query } = req.query;

    // Use a regular expression for case-insensitive matching from the start of the string
    const customers = await User.find({
      name: { $regex: `^${query}`, $options: "i" },
      role: "customer" 
    });

    res.status(200).json({
      success: true,
      message: "Customers fetched successfully",
      data: customers,
    });
  } catch (error) {
    console.error("Error searching customers:", error);
    res.status(500).json({
      error: error.message,
      message: "Error searching customers",
    });
  }
};


module.exports = { getCustomer, updateCustomer, searchCustomers };
