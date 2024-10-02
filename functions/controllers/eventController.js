const { User } = require("../models/User");
const { Event } = require("../models/Event");
const mongoose = require("mongoose");

const createEvent = async (req, res) => {
  try {
    const { eventName, dateOfOrganising, location, editType } = req.body;
    const { customerId } = req.params;
    // const csvFilePath = req.file?.path;
    // const guests = csvFilePath ? await processCsvFile(csvFilePath) : [];
    const customer = await User.findById(customerId);
    if (!customer) {
      throw new Error("User not found");
    }

    const event = new Event({
      customerId,
      eventName,
      dateOfOrganising,
      location,
      editType,
    });

    const response = await event.save();
    if (!response) {
      throw new Error("Event not Created");
    }
    customer.events.push(event);
    await customer.save(); // Save the user after pushing the event

    res.status(201).json({
      data: event,
      message: "Event created successfully",
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
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
    // const customer = await User.findById(customerId).populate({
    //   path: "events", // Path to populate // Exclude guests field from the events
    //   select: "-events.guests", // Exclude guests field from the events
    // });

    const customer = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(customerId),
        },
      },
      {
        $lookup: {
          from: "events",
          localField: "_id",
          foreignField: "customerId",
          as: "events",
          pipeline: [
            {
              $sort: {
                createdAt: -1,
              },
            },
          ],
        },
      },

      {
        $project: {
          _id:0,
          name: 0,
          mobile: 0,
          password: 0,
          dateOfBirth: 0,
          location: 0,
          gender: 0,
          role: 0,
          credits: 0,
          clientId: 0,
          customers: 0,
          createdAt: 0,
          updatedAt: 0,
          __v: 0,
          receiveRequests: 0,
          sendRequests: 0,
          "events.customerId": 0,
          "events.guests": 0,
        },
      },
      
    ]);
    
    if (!customer) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    console.log(customer);        
    res.status(200).json({
      data: customer[0].events,
      success: true,
      message: "All Customer events fetched successfully",
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
        $lookup: {
          from: "users",
          localField: "user.clientId",
          foreignField: "_id",
          as: "client",
        },
      },
      { $unwind: "$client" },
      {
        $project: {
          eventName: 1,
          dateOfOrganising: 1,
          location: 1,
          organiser: 1,
          editType: 1,
          processingStatus: 1,
          user: {
            _id: "$user._id",
            name: "$user.name",
            clientId: "$user.clientId",
            clientName: "$client.name",
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: "All events for admin fetched successfully",
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

    const ClientEvents = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(clientId) } },
      {
        $lookup: {
          from: "users",
          localField: "customers",
          foreignField: "_id",
          as: "customers",
        },
      },
      { $unwind: "$customers" },
      {
        $lookup: {
          from: "events",
          localField: "customers.events",
          foreignField: "_id",
          as: "events",
        },
      },
      { $unwind: "$events" },
      {
        $project: {
          _id: "$events._id",
          eventName: "$events.eventName",
          dateOfOrganising: "$events.dateOfOrganising",
          editType: "$events.editType",
          location: "$events.location",
          active: "$events.active",
          createdAt: "$events.createdAt",
          updatedAt: "$events.updatedAt",
          processingStatus: "$events.processingStatus",
          customerName: "$customers.name",
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: null,
          events: { $push: "$$ROOT" },
        },
      },
      {
        $project: {
          _id: 0,
          events: 1,
        },
      },
    ]);

    if (ClientEvents.length > 0) {
      res.status(200).json({
        success: true,
        data: ClientEvents[0],
        message: "All clients' events fetched successfully",
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
    if (!mediaGrid) throw new Error("Event not exists");

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
