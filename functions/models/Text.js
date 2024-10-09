const mongoose = require("mongoose");

const TextSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  },
  inputFile: {
    type: String,
  },
  texts: [
    {
      id: String,
      duration: Number,
      fontColor: String,
      fontFamily: String,
      fontSize: Number,
      fontWeight: String,
      fontStyle: String,
      backgroundOpacity: String,
      position: {
        x: Number,
        y: Number,
      },
      backgroundColor: String,
      hidden: Boolean,
      page: Number,
      size: {
        height: Number,
        width: Number,
      },
      startTime: Number,
      text: String,
      underline: String,
      transition: {
        type: Object,
        default: null,
      },
    },
  ],
});

const Text = mongoose.model("Text", TextSchema);

module.exports = { Text };
