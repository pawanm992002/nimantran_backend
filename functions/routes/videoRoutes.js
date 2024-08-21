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
  videoDuration
) => {
  return new Promise(async (resolve, reject) => {
    const streams = await Promise.all(
      texts.map((text) =>
        createCanvasWithCenteredText(val, text, scalingFont, scalingH, scalingW)
      )
    );

    // Assign the resolved values to text.stream
    streams.forEach((stream, index) => {
      texts[index].stream = stream;
    });

    const outputFilename = `processed_video_${i}_${Date.now()}.mp4`;
    const tempOutputPath = path.join(UPLOAD_DIR, outputFilename);

    const processedVideo = ffmpeg().input(inputPath);

    texts.forEach((text) => {
      processedVideo.input(text.stream).loop(1); // change the loop time
    });

    processedVideo.loop(videoDuration);

    const configuration = texts.flatMap((text, idx) => {
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
        outputs: idx === texts.length - 1 ? "result" : `[tmp${idx + 1}]`,
      };

      // Add transition filter if specified
      if (text.transition) {
        switch (text.transition.type) {
          case "move_up":
            filterConfig = {
              filter: "overlay",
              options: {
                x: xPos,
                y: `if(lt(t,${text.startTime}+${
                  text.transition.options.duration
                }), (${yPos + text.transition.options.top} + (t-${
                  text.startTime
                })*(${yPos}-${yPos + text.transition.options.top})/${
                  text.transition.options.duration
                }), ${yPos})`,
                enable: `between(t,${text.startTime},${text.duration})`,
              },
              inputs:
                idx === 0 ? ["0:v", "1:v"] : [`[tmp${idx}]`, `${idx + 1}:v`],
              outputs: idx === texts.length - 1 ? "result" : `[tmp${idx + 1}]`,
            };
            break;
          case "move_down":
            filterConfig = {
              filter: "overlay",
              options: {
                x: xPos,
                y: `if(lt(t,${text.startTime}+${
                  text.transition.options.duration
                }), (${yPos - text.transition.options.bottom} + (t-${
                  text.startTime
                })*(${yPos}-${yPos - text.transition.options.bottom})/${
                  text.transition.options.duration
                }), ${yPos})`,
                enable: `between(t,${text.startTime},${text.duration})`,
              },
              inputs:
                idx === 0 ? ["0:v", "1:v"] : [`[tmp${idx}]`, `${idx + 1}:v`],
              outputs: idx === texts.length - 1 ? "result" : `[tmp${idx + 1}]`,
            };
            break;
          case "move_right":
            filterConfig = {
              filter: "overlay",
              options: {
                x: `if(lt(t,${text.startTime}+${
                  text.transition.options.duration
                }), (${xPos - text.transition.options.right} + (t-${
                  text.startTime
                })*(${xPos}-${xPos - text.transition.options.right})/${
                  text.transition.options.duration
                }), ${xPos})`,
                y: yPos,
                enable: `between(t,${text.startTime},${text.duration})`,
              },
              inputs:
                idx === 0 ? ["0:v", "1:v"] : [`[tmp${idx}]`, `${idx + 1}:v`],
              outputs: idx === texts.length - 1 ? "result" : `[tmp${idx + 1}]`,
            };
            break;
          case "move_left":
            filterConfig = {
              filter: "overlay",
              options: {
                x: `if(lt(t,${text.startTime}+${
                  text.transition.options.duration
                }), (${xPos + text.transition.options.left} + (t-${
                  text.startTime
                })*(${xPos}-${xPos + text.transition.options.left})/${
                  text.transition.options.duration
                }), ${xPos})`,
                y: yPos,
                enable: `between(t,${text.startTime},${text.duration})`,
              },
              inputs:
                idx === 0 ? ["0:v", "1:v"] : [`[tmp${idx}]`, `${idx + 1}:v`],
              outputs: idx === texts.length - 1 ? "result" : `[tmp${idx + 1}]`,
            };
            break;
          case "slide":
            filterConfig = {
              filter: "overlay",
              options: {
                x: `if(lt(t,${text.startTime}+${
                  text.transition.options.duration
                }), (${xPos - text.transition.options.left} + (t-${
                  text.startTime
                })*(${xPos + text.transition.options.right}-${
                  xPos - text.transition.options.left
                })/${text.transition.options.duration}), ${
                  xPos + text.transition.options.right
                })`,
                y: `if(lt(t,${text.startTime}+${
                  text.transition.options.duration
                }), (${yPos - text.transition.options.top} + (t-${
                  text.startTime
                })*(${yPos + text.transition.options.bottom}-${
                  yPos - text.transition.options.top
                })/${text.transition.options.duration}), ${
                  yPos + text.transition.options.bottom
                })`,
                enable: `between(t,${text.startTime},${text.duration})`,
              },
              inputs:
                idx === 0 ? ["0:v", "1:v"] : [`[tmp${idx}]`, `${idx + 1}:v`],
              outputs: idx === texts.length - 1 ? "result" : `[tmp${idx + 1}]`,
            };
            break;
          case "path_cover":
            const rotationSpeed = text.transition.options.rotationSpeed;
            const clockwise = text.transition.options.clockwise !== false; // Default to clockwise if not specified

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
              outputs: idx === texts.length - 1 ? "result" : `[tmp${idx + 1}]`,
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
                // inputs:
                //   idx === 0
                //     ? ["0:v", `fade${idx + 1}`]
                //     : [`[tmp${idx}]`, `fade${idx + 1}`],
                outputs:
                  idx === texts.length - 1 ? "result" : `[tmp${idx + 1}]`,
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
          const videoBuffer = fs.readFileSync(tempOutputPath);

          resolve(videoBuffer);
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

const processCsvFile = (csvFilePath) => {
  return new Promise((resolve, reject) => {
    const guestNames = [];
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("data", (data) => guestNames.push(data))
      .on("end", () => {
        fs.unlinkSync(csvFilePath);
        resolve(guestNames);
      })
      .on("error", reject);
  });
};

router.post(
  "/",
  authenticateJWT,
  fileParser({ rawBodyOptions: { limit: "200mb" } }),
  async (req, res) => {
    let inputPath;
    try {
      const { textProperty, scalingFont, scalingW, scalingH, isSample, videoDuration } =
        req.body;

      const eventId = req?.query?.eventId;

      let { guestNames } = req.body;

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

      const zipFilename = `processed_videos_${Date.now()}.zip`;
      const zipPath = path.join(UPLOAD_DIR, zipFilename);

      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.on("error", (err) => {
        throw err;
      });

      archive.pipe(output);

      const videoFilenames = await Promise.all(
        guestNames.map(async (val, i) => {
          const buffer = await createVideoForGuest(
            inputPath,
            texts,
            scalingFont,
            scalingH,
            scalingW,
            val,
            i,
            videoDuration
          );
          const filename = `${val?.name}_${val?.mobileNumber}.mp4`;
          archive.append(buffer, { name: filename });

          const url = await uploadFileToFirebase(
            buffer,
            filename,
            eventId,
            isSample
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
          isSample
        );

        fs.unlinkSync(zipPath);

        if (isSample !== "true") {
          const amountSpend = 1 * guestNames.length;

          await addOrUpdateGuests(eventId, guestNames, zipUrl);
          await createTransaction(
            "video",
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
      res.status(400).json({ error: error.message });
    } finally {
      fs.unlinkSync(inputPath); // Clean up the uploaded video file
    }
  }
);

module.exports = router;
