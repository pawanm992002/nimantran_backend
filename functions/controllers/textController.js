const { Text } = require("../models/Text");

const saveText = async (req, res) => {
  try {
    const { texts, inputFile } = req.body;
    const { eventId } = req.query;

    if (!eventId) throw new Error("Event ID not found");

    if (inputFile) {
      const savedStates = await Text.updateOne(
        { eventId },
        {
          $set: {
            texts: texts,
            inputFile: inputFile,
          },
        },
        { upsert: true }
      );

      if (!savedStates) throw new Error("States are not saving");

      return res.status(200).json(savedStates);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getTexts = async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) throw new Error("Event ID not found");

    const texts = await Text.findOne({ eventId });
    if (!texts) throw new Error("States not Exists");

    return res.status(200).json(texts);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

module.exports = { saveText, getTexts };
