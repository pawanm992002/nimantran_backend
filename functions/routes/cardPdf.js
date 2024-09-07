const express = require("express");
const { fileParser } = require("express-multipart-file-parser");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { PDFDocument } = require("pdf-lib");
const os = require("os");
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

const router = express.Router();

const UPLOAD_DIR = os.tmpdir() || "/tmp";
const PDF_UPLOAD_DIR = path.join(UPLOAD_DIR, "video");

if (!fs.existsSync(PDF_UPLOAD_DIR)) {
  fs.mkdirSync(PDF_UPLOAD_DIR);
}

const createPdfForGuest = async (
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
    archive.append(new Buffer.from(buffer), { name: filename });

    const url = await uploadFileToFirebase(buffer, filename, eventId, isSample);
    val.link = url;
    return url;
  } catch (error) {
    throw error;
  }
};

router.post(
  "/",
  authenticateJWT,
  async (req, res) => {
    try {
      let inputPath;
      const {
        textProperty,
        scalingFont,
        scalingW,
        scalingH,
        isSample,
        fileName
      } = req.body;

      let {guestNames} = req.body;

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

      if (isSample) {
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
        const zipFilename = `processed_pdfs.zip`;
        const zipPath = path.join(UPLOAD_DIR, zipFilename);

        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.on("error", (err) => {
          throw err;
        });

        archive.pipe(output);

        await Promise.all(
          guestNames.map(async (val, i) => {
            await createPdfForGuest(
              inputPath,
              textProperty,
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

          if (!isSample) {
            const customerId = await addOrUpdateGuests(
              eventId,
              guestNames,
              zipUrl
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
          res.write(`zipUrl: ${zipUrl}`);
          res.end();
        });
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    } 
  }
);

module.exports = router;
