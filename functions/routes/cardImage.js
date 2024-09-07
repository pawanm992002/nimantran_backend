const express = require("express");
const {firebaseStorage} = require("../firebaseConfig");
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const { authenticateJWT } = require("../middleware/auth");
const createTransaction = require("../utility/creditTransiction");
const {
  addOrUpdateGuests,
  createCanvasWithCenteredText,
  uploadFileToFirebase,
} = require("../utility/proccessing");
const archiver = require("archiver");
const { User } = require("../models/User");
const { ref, getBytes } = require("firebase/storage");

const router = express.Router();

const UPLOAD_DIR = os.tmpdir() || "/tmp";
const VIDEO_UPLOAD_DIR = path.join(UPLOAD_DIR, "video");

if (!fs.existsSync(VIDEO_UPLOAD_DIR)) {
  fs.mkdirSync(VIDEO_UPLOAD_DIR);
}

const createImagesForGuest = async (
  inputPath,
  texts,
  scalingFont,
  scalingH,
  scalingW,
  val,
  archive,
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

    const filename = `${val?.name}_${val?.mobileNumber}.png`;
    archive.append(outputBuffer, { name: filename });

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
      guestNames = [
        { name: "pawan mishra", mobileNumber: "1111111111" },
        {
          name: "Dr. Venkatanarasimha Raghavan Srinivasachariyar Iyer",
          mobileNumber: "2222222222",
        },
        {
          name: "Raj",
          mobileNumber: "3333333333",
        },
        {
          name: "Kushagra Nalwaya",
          mobileNumber: "4444444444",
        },
        {
          name: "HARSHIL PAGARIA",
          mobileNumber: "5555555555",
        },
      ];
    } else {
      amountSpend = 0.25 * guestNames.length;

      if (user.credits - amountSpend <= 0)
        throw new Error("Insufficient Balance");
    }

    const texts = textProperty;

    if (!texts || !inputPath) {
      throw new Error("Please provide the guest list and video.");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    setImmediate(async () => {
      const zipFilename = `processed_images.zip`;
      const zipPath = path.join(UPLOAD_DIR, zipFilename);

      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.on("error", (err) => {
        throw err;
      });

      archive.pipe(output);

      await Promise.all(
        guestNames?.map(async (val) => {
          await createImagesForGuest(
            inputPath,
            texts,
            scalingFont,
            scalingH,
            scalingW,
            val,
            archive,
            eventId,
            isSample
          );

          // Send update to the client
          res.write(`data: ${JSON.stringify(val)}\n\n`);
        })
      );

      await archive.finalize();

      output.on("close", async () => {
        const zipBuffer = fs.readFileSync(zipPath);
        const zipUrl = await uploadFileToFirebase(
          zipBuffer,
          zipFilename,
          eventId,
          isSample
        );
        fs.unlinkSync(zipPath);

        if (isSample !== "true") {
          const customerId = await addOrUpdateGuests(
            eventId,
            guestNames,
            zipUrl
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
        res.write(`zipUrl: ${zipUrl}`);
        res.end();
      });
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  } 
});

module.exports = router;
