const axios = require("axios");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { createCanvas, registerFont, deregisterAllFonts } = require("canvas");
const { Event } = require("../models/Event");
const { app, firebaseStorage } = require("../firebaseConfig");
const { ref, uploadBytes, getDownloadURL } = require("firebase/storage");

const TEMP_DIR = os.tmpdir() || "/tmp";

const FONT_DIR = path.join(TEMP_DIR, "fonts");

if (!fs.existsSync(FONT_DIR)) {
  fs.mkdirSync(FONT_DIR);
}

const downloadGoogleFont = async (fontFamily) => {
  const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(
    / /g,
    "+"
  )}`;
  const response = await axios.get(fontUrl);
  const fontCss = response.data;

  const fontFileUrlMatch = fontCss.match(/url\((https:\/\/[^)]+)\)/);
  if (!fontFileUrlMatch) {
    throw new Error(
      `Could not find font file URL in Google Fonts response for ${fontFamily}`
    );
  }

  const fontFileUrl = fontFileUrlMatch[1];
  const fontFileName = `${fontFamily.replace(/ /g, "_")}.ttf`;
  const fontFilePath = path.join(FONT_DIR, fontFileName);

  if (!fs.existsSync(fontFilePath)) {
    const fontFileResponse = await axios.get(fontFileUrl, {
      responseType: "arraybuffer",
    });
    fs.writeFileSync(fontFilePath, fontFileResponse.data);
  }

  return fontFilePath;
};

const addOrUpdateGuests = async (eventId, guests, zipUrl) => {
  try {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    event.zipUrl = zipUrl
    guests.forEach((guest) => {
      const existingGuestIndex = event.guests.findIndex(
        (g) => g.mobileNumber === guest.mobileNumber
      );

      if (existingGuestIndex !== -1) {
        event.guests[existingGuestIndex].name = guest.name;
        event.guests[existingGuestIndex].link =
          guest.link || event.guests[existingGuestIndex].link;
      } else {
        event.guests.push({
          name: guest.name,
          mobileNumber: guest.mobileNumber,
          link: guest.link,
        });
      }
    });

    const updatedEvent = await event.save();
    return updatedEvent;
  } catch (error) {
    return error;
  }
};

const createCanvasWithCenteredText = async (
  val,
  property,
  scalingFont,
  scalingH,
  scalingW
) => {
  // Download the Google font and set the path
  const fontPath = await downloadGoogleFont(property.fontFamily);

  // Parse the initial font size with scaling
  let fontSize = parseInt(property.fontSize * scalingFont);

  // Build the font string based on the initial size
  const buildFontString = (size) => {
    return `${property.fontStyle === "italic" ? "italic" : ""} ${
      property.fontWeight
    } ${size}px ${property.fontFamily}`;
  };

  // Register the font for use in the canvas
  registerFont(fontPath, { family: property.fontFamily });

  // Replace template placeholders in text with values
  let tempTextName = property.text.replace(
    /{(\w+)}/g,
    (match, p1) => val[p1] || ""
  );

  // Set the canvas size according to the scaled width and height
  const width = property.size.width * scalingW;
  const height = property.size.height * scalingH;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Fill the background if a color is specified
  if (property.backgroundColor !== "none") {
    ctx.fillStyle = property.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  // Set the initial font color
  ctx.fillStyle = property.fontColor;

  // Set the font and adjust size if the text exceeds the canvas width
  ctx.font = buildFontString(fontSize);

  while (ctx.measureText(tempTextName).width > width && fontSize > 1) {
    fontSize--;  // Decrease the font size
    ctx.font = buildFontString(fontSize);  // Rebuild the font string with the new size
  }

  // Set text alignment and baseline
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Calculate the center of the canvas for text placement
  const x = width / 2;
  const y = height / 2;
  
  // Draw the text onto the canvas
  ctx.fillText(tempTextName, x, y);

  // Return the canvas buffer as an image
  return canvas.toBuffer();
};

const uploadFileToFirebase = async (
  fileBuffer,
  filename,
  eventId,
  isSample,
) => {
  try {
    let storageRef;
    if (isSample === "true") {
      storageRef = ref(firebaseStorage, `sample/${eventId}/${filename}`);
    } else {
      storageRef = ref(firebaseStorage, `uploads/${eventId}/${filename}`);
    }
    const snapshot = await uploadBytes(storageRef, fileBuffer);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading file to Firebase:", error);
    throw error;
  }
};

module.exports = {
  downloadGoogleFont,
  addOrUpdateGuests,
  createCanvasWithCenteredText,
  uploadFileToFirebase
};
