const mongoose = require("mongoose");
const { Number } = require("twilio/lib/twiml/VoiceResponse");

const TextSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  },
  inputFile:{
    type:String,
  },
  texts: [
    {
      backgroundColor: String,
      duration: Number,
      fontColor: String,
      fontFamily: String,
      fontSize: Number,
      fontStyle: String,
      fontWeight: String,
      hidden: Boolean,
      id: Number,
      page: Number,
      position: {
        x: Number,
        y: Number,
      },
      size: {
        height: Number,
        width: Number,
      },
      startTime: mongoose.Schema.Types.Decimal128,
      text: String,
      transition: {
          type:Object,
      },
      eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },

    },
  ],
});

const Text = mongoose.model("Text", TextSchema);

module.exports = { Text };
