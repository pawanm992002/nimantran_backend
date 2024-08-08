const mongoose = require("mongoose");

const TextSchema = new mongoose.Schema({
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
        x: mongoose.Schema.Types.Decimal128,
        y: mongoose.Schema.Types.Decimal128,
    },
    size: {
        height: mongoose.Schema.Types.Decimal128,
        width: mongoose.Schema.Types.Decimal128,
    },
    startTime: mongoose.Schema.Types.Decimal128,
    text: String,
    transition: {
        options: Object,
        type: String,
    },
    length: Number,
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event"
    }
}, { timestamps: true });

const Text = mongoose.model("Text", TextSchema);

module.exports = {Text};
