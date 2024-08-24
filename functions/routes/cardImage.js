const express = require("express");
const { fileParser } = require("express-multipart-file-parser");
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

router.post(
  "/",
  authenticateJWT,
  fileParser({ rawBodyOptions: { limit: "200mb" } }),
  async (req, res) => {
    let inputPath;
    try {
      const { textProperty, scalingFont, scalingW, scalingH, isSample } =
        req.body;

      const eventId = req?.query?.eventId;
      if (!eventId) throw new Error("Required Event Id");
      let amountSpend;
      let { guestNames } = req.body;

      const inputFileName = req.files.find((val) => val.fieldname === "video");

      inputPath = `${path.join(VIDEO_UPLOAD_DIR)}/${
        inputFileName.originalname
      }`;

      fs.writeFileSync(inputPath, inputFileName.buffer);

      const user = await User.findById(req.user._id);
      if (!user) throw new Error("User not found");

      if (isSample === "true") {
        guestNames = [
          { name: "pawan mishra", mobileNumber: "912674935684" },
          {
            name: "Wolf eschlegelst einhausen berger dorff",
            mobileNumber: "913647683694",
          },
        ];
      } else {
        guestNames = JSON.parse(guestNames);
        amountSpend = 0.25 * guestNames.length;

        if (user.credits - amountSpend <= 0)
          throw new Error("Insufficient Balance");
      }

      const texts = JSON.parse(textProperty);

      if (!texts || !inputPath) {
        return res
          .status(400)
          .json({ error: "Please provide the guest list and video." });
      }

      const zipFilename = `processed_images.zip`;
      const zipPath = path.join(UPLOAD_DIR, zipFilename);

      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.on("error", (err) => {
        throw err;
      });

      archive.pipe(output);

      await Promise.all(
        guestNames.map(async (val, i) => {
          const url = await createImagesForGuest(
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
          const customerId = await addOrUpdateGuests(eventId, guestNames, zipUrl);

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
        
        res.status(200).json({
          zipUrl,
          videoUrls: guestNames,
        });
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    } finally {
      fs.unlinkSync(inputPath);
    }
  }
);

module.exports = router;
