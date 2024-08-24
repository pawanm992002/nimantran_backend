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
  },
  active: {
    type: Boolean,
    default: false,
    enum: [true, false],
  },
  zipUrl: {
    type: String
  }
}, {
  timestamps: true
});

const Event = mongoose.model("Event", EventSchema);

module.exports = { Event };
