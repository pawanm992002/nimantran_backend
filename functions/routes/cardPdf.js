const express = require("express");
const { PDFDocument } = require("pdf-lib");
const {
  createCanvasWithCenteredText,
  addOrUpdateGuests,
  uploadFileToFirebase,
} = require("../utility/proccessing");
const createTransaction = require("../utility/creditTransiction");
const { authenticateJWT } = require("../middleware/auth");
const { User } = require("../models/User");
const { firebaseStorage } = require("../firebaseConfig");
const { ref, getBytes } = require("firebase/storage");
const { SampleGuestList } = require('../constants');
const { Event } = require("../models/Event");

const router = express.Router();

const createPdfForGuest = async (
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
          5
        );
        return { ...text, stream };
      })
    );

    // const inputPdf = await fs.promises.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(inputPath);

    const pages = pdfDoc.getPages();

    await Promise.all(
      streams.map(async (text) => {
        const img = await pdfDoc.embedPng(text.stream);
        const page = pages[text.page];

        page.drawImage(img, {
          x: text.position.x * scalingW,
          y:
            page.getHeight() -
            text.position.y * scalingH -
            text.size.height * scalingH,
          width: text.size.width * scalingW,
          height: text.size.height * scalingH,
          opacity: 1.0,
        });
      })
    );

    const buffer = await pdfDoc.save();

    const filename = `${val?.name}_${val?.mobileNumber}.pdf`;

    const url = await uploadFileToFirebase(buffer, filename, eventId, isSample);

    val.link = url;
    return url;
  } catch (error) {
    throw error;
  }
};

router.post("/", authenticateJWT, async (req, res) => {
  try {
    let inputPath;
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
    if(!event) throw new Error("Event not found");

    event.processingStatus = "processing";
    await event.save();

    const storageRef = ref(firebaseStorage, `uploads/${eventId}/${fileName}`);

    inputPath = await getBytes(storageRef); // Get the file as a byte array

    let amountSpend;

    if (textProperty?.length === 0) {
      throw new Error("First Put some text box");
    }

    const user = await User.findById(req.user._id);
    if (!user) throw new Error("User not found");

    if (isSample) {
      guestNames = SampleGuestList;
    } else {
      amountSpend = 0.5 * guestNames.length;

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
      // Control concurrency to avoid overwhelming the server
      const concurrencyLimit = 10;
      const chunks = chunkArray(guestNames, concurrencyLimit);

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (val, i) => {
            await createPdfForGuest(
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
      }

      if (!isSample) {
        const customerId = await addOrUpdateGuests(
          eventId,
          guestNames
        );

        await createTransaction(
          "pdf",
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

// Helper function to chunk an array into smaller arrays of a specified size
const chunkArray = (array, chunkSize) => {
  return array.reduce((acc, _, i) => {
    if (i % chunkSize === 0) acc.push(array.slice(i, i + chunkSize));
    return acc;
  }, []);
};

module.exports = router;