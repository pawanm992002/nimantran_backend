const express = require("express");
const { fileParser } = require("express-multipart-file-parser");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const archiver = require("archiver");
const { createCanvas, registerFont, deregisterAllFonts } = require("canvas");
const { authenticateJWT } = require("../middleware/auth");
const {
  downloadGoogleFont,
  addOrUpdateGuests,
  uploadFileToFirebase,
} = require("../utility/proccessing");
const createTransaction = require("../utility/creditTransiction");
const os = require("os");
const { User } = require("../models/User");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffmpegPath);

const router = express.Router();

// const UPLOAD_DIR = path.join(__dirname, "../tmp");
const UPLOAD_DIR = os.tmpdir() || "/tmp";
const VIDEO_UPLOAD_DIR = path.join(UPLOAD_DIR, "video");

if (!fs.existsSync(VIDEO_UPLOAD_DIR)) {
  fs.mkdirSync(VIDEO_UPLOAD_DIR);
}

const createCanvasWithCenteredText = async (
  val,
  property,
  scalingFont,
  scalingH,
  scalingW
) => {
  const fontPath = await downloadGoogleFont(property.fontFamily);
  registerFont(fontPath, { family: property.fontFamily });

  let tempTextName = property.text.replace(
    /{(\w+)}/g,
    (match, p1) => val[p1] || ""
  );
  let width = parseInt(property.size.width * scalingW);
  let height = parseInt(property.size.height * scalingH);

  width = width % 2 ? width + 1 : width;
  height = height % 2 ? height + 1 : height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (property.backgroundColor !== "none") {
    ctx.fillStyle = property.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height); // Clear the canvas for transparency
  }

  ctx.fillStyle = property.fontColor;

  let fontSize = property.fontSize * scalingFont;
  ctx.font = `${fontSize}px ${property.fontFamily}`;

  // Adjust font size to fit text within canvas width
  while (ctx.measureText(tempTextName).width > width && fontSize > 1) {
    fontSize--;
    ctx.font = `${fontSize}px ${property.fontFamily}`;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const x = width / 2;
  const y = height / 2;
  ctx.fillText(tempTextName, x, y);

  deregisterAllFonts();

  return canvas.toDataURL();
};

const createVideoForGuest = (
  inputPath,
  texts,
  scalingFont,
  scalingH,
  scalingW,
  val,
  i,
  videoDuration,
  archive,
  isSample,
  eventId
) => {
  return new Promise(async (resolve, reject) => {
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

    const outputFilename = `processed_video_${i}_${Date.now()}.mp4`;
    const tempOutputPath = path.join(UPLOAD_DIR, outputFilename);

    const processedVideo = ffmpeg().input(inputPath);

    streams.map((text) => {
      processedVideo.input(text.stream).loop(0.1); // change the loop time
    });

    processedVideo.loop(videoDuration);

    const configuration = streams.flatMap((text, idx) => {
      const xPos = parseInt(text.position.x * scalingW);
      const yPos = parseInt(text.position.y * scalingH + 5);

      let filterConfig = {
        filter: "overlay",
        options: {
          x: xPos,
          y: yPos,
          enable: `between(t,${parseInt(text.startTime)},${parseInt(
            text.duration // this is end time
          )})`,
        },
        inputs: idx === 0 ? ["0:v", "1:v"] : [`[tmp${idx}]`, `${idx + 1}:v`],
        outputs: idx === streams.length - 1 ? "result" : `[tmp${idx + 1}]`,
      };

      // Add transition filter if specified
      if (text.transition) {
        switch (text.transition.type) {
          case "move_up":
            let moveToTop = 50;
            filterConfig = {
              filter: "overlay",
              options: {
                x: xPos,
                y: `if(lt(t,${text.startTime}+${
                  text.transition.options.duration
                }), (${yPos + moveToTop} + (t-${text.startTime})*(${yPos}-${
                  yPos + moveToTop
                })/${text.transition.options.duration}), ${yPos})`,
                enable: `between(t,${text.startTime},${text.duration})`,
              },
              inputs:
                idx === 0 ? ["0:v", "1:v"] : [`[tmp${idx}]`, `${idx + 1}:v`],
              outputs:
                idx === streams.length - 1 ? "result" : `[tmp${idx + 1}]`,
            };
            break;
          case "move_down":
            let moveToBottom = 50;
            filterConfig = {
              filter: "overlay",
              options: {
                x: xPos,
                y: `if(lt(t,${text.startTime}+${
                  text.transition.options.duration
                }), (${yPos - moveToBottom} + (t-${text.startTime})*(${yPos}-${
                  yPos - moveToBottom
                })/${text.transition.options.duration}), ${yPos})`,
                enable: `between(t,${text.startTime},${text.duration})`,
              },
              inputs:
                idx === 0 ? ["0:v", "1:v"] : [`[tmp${idx}]`, `${idx + 1}:v`],
              outputs:
                idx === streams.length - 1 ? "result" : `[tmp${idx + 1}]`,
            };
            break;
          case "move_right":
            let moveToRight = 50;
            filterConfig = {
              filter: "overlay",
              options: {
                x: `if(lt(t,${text.startTime}+${
                  text.transition.options.duration
                }), (${xPos - moveToRight} + (t-${text.startTime})*(${xPos}-${
                  xPos - moveToRight
                })/${text.transition.options.duration}), ${xPos})`,
                y: yPos,
                enable: `between(t,${text.startTime},${text.duration})`,
              },
              inputs:
                idx === 0 ? ["0:v", "1:v"] : [`[tmp${idx}]`, `${idx + 1}:v`],
              outputs:
                idx === streams.length - 1 ? "result" : `[tmp${idx + 1}]`,
            };
            break;
          case "move_left":
            let moveToLeft = 50;
            filterConfig = {
              filter: "overlay",
              options: {
                x: `if(lt(t,${text.startTime}+${
                  text.transition.options.duration
                }), (${xPos + moveToLeft} + (t-${text.startTime})*(${xPos}-${
                  xPos + moveToLeft
                })/${text.transition.options.duration}), ${xPos})`,
                y: yPos,
                enable: `between(t,${text.startTime},${text.duration})`,
              },
              inputs:
                idx === 0 ? ["0:v", "1:v"] : [`[tmp${idx}]`, `${idx + 1}:v`],
              outputs:
                idx === streams.length - 1 ? "result" : `[tmp${idx + 1}]`,
            };
            break;
          case "slide":
            moveToTop = 50;
            moveToBottom = 50;
            moveToLeft = 50;
            moveToRight = 50;
            filterConfig = {
              filter: "overlay",
              options: {
                x: `if(lt(t,${text.startTime}+${
                  text.transition.options.duration
                }), (${xPos - moveToLeft} + (t-${text.startTime})*(${
                  xPos + moveToRight
                }-${xPos - moveToLeft})/${text.transition.options.duration}), ${
                  xPos + moveToRight
                })`,
                y: `if(lt(t,${text.startTime}+${
                  text.transition.options.duration
                }), (${yPos - moveToTop} + (t-${text.startTime})*(${
                  yPos + moveToBottom
                }-${yPos - moveToTop})/${text.transition.options.duration}), ${
                  yPos + moveToBottom
                })`,
                enable: `between(t,${text.startTime},${text.duration})`,
              },
              inputs:
                idx === 0 ? ["0:v", "1:v"] : [`[tmp${idx}]`, `${idx + 1}:v`],
              outputs:
                idx === streams.length - 1 ? "result" : `[tmp${idx + 1}]`,
            };
            break;
          case "path_cover":
            const rotationSpeed = 0.4;
            // const clockwise = text?.transition?.options?.clockwise !== false; // Default to clockwise if not specified
            const clockwise = true;

            filterConfig = {
              filter: "overlay",
              options: {
                x: `if(lt(t,${text.startTime}),${xPos},if(lt(t,${
                  text.startTime
                } + 1/${rotationSpeed}),${xPos} + (overlay_w/5) * cos(2*PI*${
                  clockwise ? "" : "-"
                }${rotationSpeed}*(t-${text.startTime})),${xPos}))`,
                y: `if(lt(t,${text.startTime}),${yPos},if(lt(t,${
                  text.startTime
                } + 1/${rotationSpeed}),${yPos} + (overlay_h/5) * sin(2*PI*${
                  clockwise ? "" : "-"
                }${rotationSpeed}*(t-${text.startTime})),${yPos}))`,
                enable: `between(t,${text.startTime},${text.duration})`,
                eval: "frame",
              },
              inputs:
                idx === 0 ? ["0:v", "1:v"] : [`[tmp${idx}]`, `${idx + 1}:v`],
              outputs:
                idx === streams.length - 1 ? "result" : `[tmp${idx + 1}]`,
            };
            break;
          case "fade":
            const fadeConfig = [
              {
                filter: "fade",
                options: {
                  type: "in",
                  start_time: text.startTime,
                  duration: text.transition.options.duration, // Fade duration in seconds
                },
                inputs: `[${idx + 1}:v]`, // Each input stream (starting from 1) (if not working change to 1:v)
                outputs: `fade${idx + 1}`,
              },
              {
                filter: "overlay",
                options: {
                  x: xPos,
                  y: yPos,
                  enable: `between(t,${parseInt(text.startTime)},${parseInt(
                    text.duration
                  )})`,
                },
                inputs:
                  idx === 0 ? "[0:v][fade1]" : `[tmp${idx}][fade${idx + 1}]`,
                outputs:
                  idx === streams.length - 1 ? "result" : `[tmp${idx + 1}]`,
              },
            ];
            return fadeConfig;
          default:
            break;
        }
      }

      return filterConfig;
    });

    processedVideo
      .complexFilter(configuration, "result")
      .outputOptions(["-c:v libx264", "-c:a aac", "-map 0:a:0?"])
      .output(tempOutputPath)
      .on("end", async () => {
        try {
          // fs.rmSync(tempOutputPath);

          const filename = `${val?.name}_${val?.mobileNumber}.mp4`;

          const fileStreamForArchive = fs.createReadStream(tempOutputPath);

          archive.append(fileStreamForArchive, { name: filename });

          const url = await uploadFileToFirebase(
            fs.readFileSync(tempOutputPath),
            filename,
            eventId,
            isSample
          );

          val.link = url;
          resolve(url);
        } catch (uploadError) {
          reject(uploadError);
        }
      })
      .on("error", (err) => {
        reject(err);
      })
      .run();
  });
};

// Helper function to chunk an array into smaller arrays of a specified size
const chunkArray = (array, chunkSize) => {
  return array.reduce((acc, _, i) => {
    if (i % chunkSize === 0) acc.push(array.slice(i, i + chunkSize));
    return acc;
  }, []);
};

router.post(
  "/",
  authenticateJWT,
  fileParser({ rawBodyOptions: { limit: "200mb" } }),
  async (req, res) => {
    let inputPath;
    try {
      const {
        textProperty,
        scalingFont,
        scalingW,
        scalingH,
        isSample,
        videoDuration,
      } = req.body;

      const eventId = req?.query?.eventId;
      if (!eventId) throw new Error("Required Event Id");
      let { guestNames } = req.body;
      let amountSpend;

      const inputFileName = req.files.find((val) => val.fieldname === "video");
      inputPath = `${path.join(VIDEO_UPLOAD_DIR)}/${
        inputFileName.originalname
      }`;
      fs.writeFileSync(inputPath, inputFileName.buffer);

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
        guestNames = JSON.parse(guestNames);
        amountSpend = 1 * guestNames.length;

        if (user.credits - amountSpend <= 0)
          throw new Error("Insufficient Balance");
      }

      const texts = JSON.parse(textProperty);

      if (!texts || !inputPath) {
        throw new Error("Please provide the guest list and video.");
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      setImmediate(async () => {
        const zipFilename = `processed_videos.zip`;
        const zipPath = path.join(UPLOAD_DIR, zipFilename);

        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.on("error", (err) => {
          throw err;
        });

        archive.pipe(output);

        // Control concurrency to avoid overwhelming the server
        const concurrencyLimit = 10;
        const chunks = chunkArray(guestNames, concurrencyLimit);

        for (const chunk of chunks) {
          await Promise.all(
            chunk.map(async (val, i) => {
              await createVideoForGuest(
                inputPath,
                texts,
                scalingFont,
                scalingH,
                scalingW,
                val,
                i,
                videoDuration,
                archive,
                isSample,
                eventId
              );

              // Send update to the client
              res.write(`data: ${JSON.stringify(val)}\n\n`);
            })
          );
        }

        await archive.finalize();

        output.on("close", async () => {
          const zipBuffer = fs.readFileSync(zipPath);
          const zipUrl = await uploadFileToFirebase(
            zipBuffer,
            zipFilename,
            eventId,
            isSample
          );

          if (isSample !== "true") {
            const customerId = await addOrUpdateGuests(
              eventId,
              guestNames,
              zipUrl
            );
            await createTransaction(
              "video",
              req.user._id,
              null,
              amountSpend,
              "completed",
              eventId,
              customerId
            );
          }
          // res.status(200).json({
          //   zipUrl,
          //   videoUrls: guestNames,
          // });
          res.end();
        });
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    } finally {
      if (!fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
    }
  }
);

module.exports = router;
