const express = require("express");
const {firebaseStorage} = require("../firebaseConfig");
const sharp = require("sharp");
const { authenticateJWT } = require("../middleware/auth");
const createTransaction = require("../utility/creditTransiction");
const {
  addOrUpdateGuests,
  createCanvasWithCenteredText,
  uploadFileToFirebase,
} = require("../utility/proccessing");
const { User } = require("../models/User");
const { ref, getBytes } = require("firebase/storage");
const { SampleGuestList } = require('../constants');
const { Event } = require("../models/Event");

const router = express.Router();

const createImagesForGuest = async (
  fileName,
  inputPath,
  texts,
  scalingFont,
  scalingH,
  scalingW,
  val,
  eventId,
  isSample
) => {
  try {
    const streams = await Promise.all(
      texts.map(async (text) => {
        const stream = await createCanvasWithCenteredText(
          val,
          text,
          scalingFont,
          scalingH,
          scalingW
        );
        return { ...text, stream };
      })
    );

    let baseImage = sharp(inputPath);

    const overlays = await Promise.all(
      streams.map(async (overlay) => {
        const { stream, position, size } = overlay;
        const overlayImage = await sharp(stream).toBuffer();

        return {
          input: overlayImage,
          left: parseInt(position.x * scalingW),
          top: parseInt(position.y * scalingH + 5),
        };
      })
    );

    baseImage = baseImage.composite(overlays);

    const outputBuffer = await baseImage.toBuffer();

    const filename = `${val?.name}_${val?.mobileNumber}-${fileName}`;

    const url = await uploadFileToFirebase(
      outputBuffer,
      filename,
      eventId,
      isSample
    );

    val.link = url;
    return url;
  } catch (error) {
    throw error;
  }
};

router.post("/", authenticateJWT, async (req, res) => {
  let inputPath;
  try {
    const { textProperty, scalingFont, scalingW, scalingH, isSample, fileName } =
      req.body;

    let { guestNames } = req.body;

    const eventId = req?.query?.eventId;
    if (!eventId) throw new Error("Required Event Id");

    const event = await Event.findById(eventId);
    if(!event) throw new Error("Event not found");

    event.processingStatus = "processing";
    await event.save();
    
    const storageRef = ref(
      firebaseStorage,
      `uploads/${eventId}/${fileName}`
    );

    inputPath = await getBytes(storageRef); // Get the file as a byte array

    let amountSpend;

    if (textProperty?.length === 0) {
      throw new Error("First Put some text box");
    }

    const user = await User.findById(req.user._id);
    if (!user) throw new Error("User not found");

    if (isSample === "true") {
      guestNames = SampleGuestList;
    } else {
      amountSpend = 0.25 * guestNames.length;

      if (user.credits - amountSpend <= 0)
        throw new Error("Insufficient Balance");
    }

    if (!textProperty || !inputPath) {
      throw new Error("Please provide the guest list and video.");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    setImmediate(async () => {

      await Promise.all(
        guestNames?.map(async (val) => {
          await createImagesForGuest(
            fileName,
            inputPath,
            textProperty,
            scalingFont,
            scalingH,
            scalingW,
            val,
            eventId,
            isSample,
          );

          // Send update to the client
          res.write(`data: ${JSON.stringify(val)}\n\n`);
        })
      );

      if (isSample !== "true") {
        const customerId = await addOrUpdateGuests(
          eventId,
          guestNames
        );

        await createTransaction(
          "image",
          req.user._id,
          null,
          amountSpend,
          "completed",
          eventId,
          customerId
        );
      }
      
      res.end();
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
    res.end();
  } 
});

module.exports = router;
