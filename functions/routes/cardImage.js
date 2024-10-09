const express = require("express");
const { firebaseStorage } = require("../firebaseConfig");
const sharp = require("sharp");
const { authenticateJWT } = require("../middleware/auth");
const createTransaction = require("../utility/creditTransiction");
const {
  addOrUpdateGuests,
  createCanvasWithCenteredText,
  uploadFileToFirebase,
} = require("../utility/proccessing");
const { User } = require("../models/User");
const { SampleGuestList } = require("../constants");
const { Event } = require("../models/Event");

const router = express.Router();

const createImagesForGuest = async (
  { metaContentType, metaFileExt },
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
          scalingW,
          "image"
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
          top: parseInt(position.y * scalingH),
        };
      })
    );

    baseImage = baseImage.composite(overlays);

    const outputBuffer = await baseImage.toBuffer();

    const filename =
      `${val?.name}_${val?.mobileNumber}_processed${metaFileExt}`.replace(
        /\s+/g,
        "_"
      );

    const url = await uploadFileToFirebase(
      outputBuffer,
      filename,
      eventId,
      isSample,
      metaContentType
    );

    val.link = url;
    return url;
  } catch (error) {
    throw error;
  }
};

router.post("/", authenticateJWT, async (req, res) => {
  try {
    const {
      textProperty,
      scalingFont,
      scalingW,
      scalingH,
      isSample,
      fileName,
    } = req.body;

    let { guestNames } = req.body;

    const eventId = req?.query?.eventId;
    if (!eventId) throw new Error("Required Event Id");

    const event = await Event.findById(eventId);
    if (!event) throw new Error("Event not found");

    event.processingStatus = "processing";
    await event.save();

    // Access the file in Firebase Storage using firebase-admin
    const storageRef = firebaseStorage.file(`uploads/${eventId}/${fileName}`);

    let [inputPath] = await storageRef.download(); // Get the file as a Buffer
    const [metadata] = await storageRef.getMetadata();
    const metaFileExt = metadata?.name?.replace(
      `uploads/${eventId}/inputFile`,
      ""
    );
    const metaContentType = metadata.contentType;

    let amountSpend;

    if (textProperty?.length === 0) {
      throw new Error("First Put some text box");
    }

    const user = await User.findById(req.user._id);
    if (!user) throw new Error("User not found");

    if (isSample) {
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
    res.flushHeaders();

    setImmediate(() => {
      (async () => {
        await Promise.all(
          guestNames?.map(async (val) => {
            await createImagesForGuest(
              { metaContentType, metaFileExt },
              inputPath,
              textProperty,
              scalingFont,
              scalingH,
              scalingW,
              val,
              eventId,
              isSample
            );

            // Send update to the client
            res.write(`data: ${JSON.stringify(val)}\n\n`);
          })
        );

        if (!isSample) {
          const customerId = await addOrUpdateGuests(eventId, guestNames);

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
      })();
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
    res.end();
  }
});

module.exports = router;
