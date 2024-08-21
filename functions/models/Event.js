const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  eventName: {
    type: String,
    required: true,
  },
  dateOfOrganising: {
    type: Date,
    required: true,
  },
  editType: {
    type: String,
    enum: ["imageEdit", "cardEdit", "videoEdit"],
  },
  guests: [
    {
      _id: false,
      name: {
        type: String,
        required: true,
      },
      mobileNumber: {
        type: String,
        required: true,
      },
      link: {
        type: String,
      },
      sid: {
        type: Array,
        default: []
      }
    },
  ],
  location: {
    type: String,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
    enum: [true, false],
  },
  zipUrl: {
    type: String
  }
});

const Event = mongoose.model("Event", EventSchema);

module.exports = { Event };
