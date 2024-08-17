const mongoose = require("mongoose");

const invitationTrackerSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.ObjectId,
    ref: "Event",
    required: true,
  },
  invitations: [
    {
      from: {
        type: String,
        required: true,
      },
      to: {
        type: String,
        required: true,
      },
      mediaType: {
        type: String,
        required: true,
        enum: ["image", "document", "video"],
      },
      status: {
        type: String,
        enum: ["sended", "notSended", "queued"],
        default: "queued",
      },
      date: {
        type: Date,
        default: Date.now(),
      },
    },
  ],
});

const invitationTracker = mongoose.model(
  "invitationTracker",
  invitationTrackerSchema
);

module.exports = { invitationTracker };
