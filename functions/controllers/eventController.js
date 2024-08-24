const { User } = require("../models/User");
const { Event } = require("../models/Event");

const createEvent = async (req, res) => {
  try {
    const { eventName, dateOfOrganising, location, editType } = req.body;
    const { customerId } = req.params;
    // const csvFilePath = req.file?.path;
    // const guests = csvFilePath ? await processCsvFile(csvFilePath) : [];
    const customer = await User.findById(customerId);
    const event = new Event({
      customerId,
      eventName,
      dateOfOrganising,
      location,
      editType
    });

    if (!customer) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    const response = await event.save();
    customer.events.push(event);
    await customer.save(); // Save the user after pushing the event

    res.status(201).json({
      data: event,
      success: true,
      message: "Event created successfully",
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      message: "Error creating event",
    });
  }
};

const updatedEvent = async (req, res) => {
  try {
    const { id, customerId } = req.params;
    const { eventName, dateOfOrganising, location } = req.body;
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    event.eventName = eventName;
    event.dateOfOrganising = dateOfOrganising;
    event.location = location;
    const customer = await User.findById(customerId).populate("events"); // Use await to get the user

    if (!customer) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const eventIndex = customer.events.findIndex(
      (e) => e._id.toString() === event._id.toString()
    );
    if (eventIndex === -1) {
      return res.status(404).json({
        message: "Event not found in user's events",
      });
    }

    customer.events[eventIndex] = event;
    await customer.save();
    await event.save();

    res.status(200).json({
      data: event,
      message: "Event updated successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(400).json({
      error: error.message,
      message: "Error updating event",
    });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { customerId, id } = req.params;
    const customer = await User.findById(customerId);
    const event = await Event.findByIdAndDelete(id);

    if (!customer || !event) {
      return res.status(404).json({
        message: "User or Event not found",
      });
    }

    const eventIndex = customer.events.indexOf(event._id);
    if (eventIndex === -1) {
      return res.status(404).json({
        message: "Event not found in user's events",
      });
    }

    customer.events.splice(eventIndex, 1);
    await customer.save();

    res.status(200).json({
      data: event,
      message: "Event deleted successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(400).json({
      error: error.message,
      message: "Error deleting event",
    });
  }
};

const getAllCustomerEvents = async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await User.findById(customerId).populate("events");

    if (!customer) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      data: customer,
      success: true,
      message: "All events fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching all events:", error);
    res.status(400).json({
      error: error.message,
      message: "Error fetching all events",
    });
  }
};

const getAllEvents = async (req, res) => {
  try {
    const events = await Event.aggregate([
      {
        $lookup: {
          from: "users", // The collection name for the users
          localField: "customerId", // The field in the events collection
          foreignField: "_id", // The field in the users collection
          as: "user", // The alias for the joined document
        },
      },
      {
        $unwind: "$user", // Unwind the user array to get a single object
      },
      {
        $project: {
          eventName: 1,
          dateOfOrganising: 1,
          location: 1,
          organiser: 1,
          "user.mobile": 1, // Only project the user's name
          "user._id": 1,
          "user.name": 1,
        },
      },
    ]);
    res.status(200).json({
      success: true,
      message: "All events fetched successfully",
      data: events,
    });
  } catch (error) {
    console.error("Error fetching all events:", error);
    res.status(400).json({
      error: error.message,
      message: "Error fetching all events",
    });
  }
};

const getAllClientEvents = async (req, res) => {
  try {
    const clientId = req.user._id;

    // Find the client by ID and populate the 'customers' and 'events' fields
    const client = await User.findById(clientId).populate({
      path: "customers",
      populate: {
        path: "events",
        model: "Event",
      },
    });

    // Check if client and client.customers exist and are arrays
    if (client && Array.isArray(client.customers)) {
      const allEventsWithCustomerNames = client.customers.map((customer) => {
        return {
          customerName: customer.name,
          events: customer.events,
        };
      });
      
      res.status(200).json({
        success: true,
        data: allEventsWithCustomerNames,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "No customers found for this client.",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    res.status(200).json({
      data: event,
      success: true,
      message: "Event fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(400).json({
      error: error.message,
      message: "Error fetching event",
    });
  }
};

const getAllGuestMedia = async (req, res) => {
  try {
    const eventId = req?.params?.id;

    const mediaGrid = await Event.findById(eventId);
    if(!mediaGrid) throw new Error("Event not exists");

    return res.status(200).json({ data: mediaGrid });

  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createEvent,
  updatedEvent,
  deleteEvent,
  getAllEvents,
  getEvent,
  getAllCustomerEvents,
  getAllClientEvents,
  getAllGuestMedia,
};
