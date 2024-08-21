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
  uploadFileToFirebase
} = require("../utility/proccessing");
const archiver = require("archiver");

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
  i
) => {
  try {
    const streams = await Promise.all(
      texts.map((text) =>
        createCanvasWithCenteredText(val, text, scalingFont, scalingH, scalingW)
      )
    );

    streams.forEach((stream, index) => {
      texts[index].stream = stream;
    });

    let baseImage = sharp(inputPath);

    const overlays = await Promise.all(
      texts.map(async (overlay) => {
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
    console.log("Image processing complete.");

    return outputBuffer;
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
      let { guestNames } = req.body;

      if (isSample === "true") {
        guestNames = [
          { name: "pawan mishra", mobileNumber: "912674935684" },
          { name: "Wolf eschlegelst einhausen berger dorff", mobileNumber: "913647683694" },
        ];
      } else {
        guestNames = JSON.parse(guestNames);
      }

      const inputFileName = req.files.find((val) => val.fieldname === "video");

      inputPath = `${path.join(VIDEO_UPLOAD_DIR)}/${
        inputFileName.originalname
      }`;

      fs.writeFileSync(inputPath, inputFileName.buffer);

      if (!eventId) throw new Error("Required Event Id");

      const texts = JSON.parse(textProperty);

      if (!texts || !inputPath) {
        return res
          .status(400)
          .json({ error: "Please provide the guest list and video." });
      }

      const zipFilename = `processed_file.zip`;
      const zipPath = path.join(UPLOAD_DIR, zipFilename);

      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.on("error", (err) => {
        throw err;
      });

      archive.pipe(output);

      await Promise.all(
        guestNames.map(async (val, i) => {
          const buffer = await createImagesForGuest(
            inputPath,
            texts,
            scalingFont,
            scalingH,
            scalingW,
            val,
            i
          );

          const filename = `${val?.name}_${val?.mobileNumber}.png`;
          archive.append(buffer, { name: filename });

          const url = await uploadFileToFirebase(
            buffer,
            filename,
            eventId,
            isSample,
          );

          val.link = url;
          return url;
        })
      );

      await archive.finalize();

      output.on("close", async () => {
        const zipBuffer = fs.readFileSync(zipPath);
        const zipUrl = await uploadFileToFirebase(
          zipBuffer,
          zipFilename,
          eventId,
          isSample,
        );
        fs.unlinkSync(zipPath);

        if (isSample !== "true") {
          const amountSpend = 0.25 * guestNames.length;

          await addOrUpdateGuests(eventId, guestNames, zipUrl);

          await createTransaction(
            "image",
            req.user._id,
            null,
            amountSpend,
            "completed",
            eventId
          );
        }

        res.status(200).json({
          zipUrl,
          videoUrls: guestNames,
        });
      });
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Image processing failed" });
    } finally {
      fs.unlinkSync(inputPath);
    }
  }
);

module.exports = router;
