const twilio = require("twilio"); // for business messages
const { Event } = require("../models/Event");
const { Client, MessageMedia } = require("whatsapp-web.js"); // for personal messages
const qrcode = require("qrcode");
const { invitationTracker } = require("../models/InvitationTracker");
// const fs = require("fs");
// const path = require("path");
// const axios = require('axios');
// const os = require('os');

// const UPLOAD_DIR = os.tmpdir()
// const mediaUploadDir = path.join(UPLOAD_DIR, "mediaUpload")

// if (!fs.existsSync(mediaUploadDir)) {
//   fs.mkdirSync(mediaUploadDir);
// }

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
let clientPersonal;

// clientPersonal.on("ready", () => {
//   console.log("Client is ready!");
// });
// clientPersonal.on("auth_failure", (msg) => {
//   // Fired if authentication fails
//   console.log("Authentication failure:");
// });
// clientPersonal.on("disconnected", (reason) => {
//   // Fired when the client is disconnected from the WhatsApp Web
//   console.log("Client was logged out:");
// });

// const generateQR = (req, res) => {
//   clientPersonal = new Client({
//     puppeteer: { headless: false },
//     session: null,
//   });
//   let qrCodeData = null;
//   const clientPersonalPromise = clientPersonal.initialize();

//   clientPersonal.on("qr", (qr) => {
//     qrcode.toDataURL(qr, (err, url) => {
//       qrCodeData = url;
//     });
//   });
//   clientPersonalPromise
//     .then(() => {
//       res.status(200).send({ qrCode: qrCodeData });
//     })
//     .catch(() => {
//       res.status(400).send({ qrCode: null });
//     });
// };

const generateQR = async (req, res) => {
  const clientPersonal = new Client();
  let qrCodeGenerated = false;

  try {
    const qrCodePromise = new Promise((resolve, reject) => {
      clientPersonal.on("qr", (qr) => {
        qrcode.toDataURL(qr, (err, url) => {
          if (err) {
            reject(new Error("Failed to generate QR code"));
          } else {
            qrCodeGenerated = true;
            resolve(url);
          }
        });
      });

      clientPersonal.initialize().catch((err) => {
        reject(new Error("Failed to initialize client"));
      });
    });

    // Wait for QR code to be generated, but set a timeout to avoid hanging indefinitely
    const qrCodeUrl = await Promise.race([
      qrCodePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("QR code generation timed out")), 10000)), // 10-second timeout
    ]);

    if (qrCodeGenerated) {
      res.status(200).send({ qrCode: qrCodeUrl });
    } else {
      res.status(400).send({ qrCode: null, error: "QR code generation timed out" });
    }
  } catch (error) {
    res.status(400).send({ qrCode: null, error: error.message });
  }
};


const individualWhatsuppPersonalInvite = async (req, res) => {
  try {
    if (!clientPersonal?.info || !clientPersonal?.info?.wid) {
      throw new Error("WhatsApp client is not ready yet. Try Again");
    }

    const { number, mediaUrl } = req.body;
    const chatId = `${number}@c.us`;
    const caption = "This is a Invitation Message";
    const { eventId } = req.query;

    // Define a temporary file path
    // const fileName = path.basename(mediaUrl.split("?")[0]);
    // const mediaPath = path.join(mediaUploadDir, fileName);

    // // Download the media from Firebase URL and save it temporarily
    // const response = await axios({
    //   url: mediaUrl,
    //   method: "GET",
    //   responseType: "stream",
    // });

    // await new Promise((resolve, reject) => {
    //   const writer = fs.createWriteStream(mediaPath);
    //   response.data.pipe(writer);
    //   writer.on("finish", resolve);
    //   writer.on("error", reject);
    // });

    // Fetch the media from the Firebase URL
    const media = await MessageMedia.fromUrl(mediaUrl);
    // const media = MessageMedia.fromFilePath(mediaPath);

    if (!media) {
      throw new Error("Failed to fetch media from the provided URL.");
    }

    // Send the media with an optional caption
    const invitations = await clientPersonal.sendMessage(chatId, media, {
      caption,
    });

    if (!invitations) throw new Error("Something Wrong");

    // fs.unlinkSync(mediaPath);

    const invitation = {
      from: invitations?.from,
      to: invitations?.to,
      mediaType: invitations?.type,
      status: "sended",
    };

    const isInvitationsExits = await invitationTracker.findOneAndUpdate(
      { eventId },
      {
        $push: {
          invitations: invitation,
        },
      }
    );
    if (!isInvitationsExits) {
      const newInvitations = new invitationTracker({
        eventId,
        invitations: invitation,
      });
      await newInvitations.save();
    }
    res.status(200).send({ success: true, invitation });
  } catch (error) {
    res.status(400).send({ success: false, message: error.message });
  }
};

const bulkWhatsuppPersonalInvite = async (req, res) => {
  try {
    if (!clientPersonal?.info || !clientPersonal?.info?.wid) {
      throw new Error("WhatsApp client is not ready yet. Try Again");
    }
    const { eventId } = req.query;
    const guests = await Event.findById(eventId)?.select("guests");

    const invitations = await Promise.all(
      guests?.guests?.map(async (guest) => {
        const chatId = `${guest?.mobileNumber}@c.us`;
        const caption = "This is a Invitation Message";
        const mediaUrl = guest.link;

        // Fetch the media from the Firebase URL
        const media = await MessageMedia.fromUrl(mediaUrl);

        // Send the media with an optional caption
        const response = await clientPersonal?.sendMessage(chatId, media, {
          caption,
        });
        return {
          from: response.from,
          to: response.to,
          mediaType: response.type,
          status: "sended", // ["sended", "notSended", "queued"]
        };
      })
    );
    if (!invitations) throw new Error("Something Wrong");

    const isInvitationsExits = await invitationTracker.findOneAndUpdate(
      { eventId },
      {
        $push: { invitations: invitations },
      }
    );
    if (!isInvitationsExits) {
      const newInvitations = new invitationTracker({
        eventId,
        invitations,
      });
      await newInvitations.save();
    }

    res
      .status(200)
      .json({ message: "Invitations are sended", data: invitations });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const individualWhatsuppBusinessInvite = async (req, res) => {
  try {
    let { mobileNumber, link } = req.body;
    const { eventId } = req.query;
    mobileNumber =
      mobileNumber?.at(0) === "+" ? mobileNumber : "+" + mobileNumber;

    const messageResp = await client.messages.create({
      body: "Your appointment is coming up on July 21 at 10PM",
      from: "whatsapp:+14155238886",
      to: `whatsapp:${mobileNumber}`,
    });

    const savedEvent = await Event.findById(eventId);

    savedEvent.guests.forEach((guest) => {
      if (guest.mobileNumber === mobileNumber) {
        guest.sid.push(messageResp.sid);
      }
    });

    const result = await savedEvent.save();

    return res.status(200).json({ message: "message sent.", data: result });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const bulkWhatsuppBusinessInvite = async (req, res) => {
  try {
    // later
    return res.status(200).json({ data: null });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const fetchWhatsappInvitations = async (req, res) => {
  try {
    const { eventId } = req.query;

    const invitations = await invitationTracker.findOne({ eventId });
    if (!invitations) throw new Error("There are no Invitations yet");

    // const guests = await Event.findById(eventId)?.select("guests");
    // if (!guests) throw new Error("Event not Found");

    // const fetchedMessages = await Promise.all(
    //   guests?.guests?.map(async (guest) => {
    //     const populateGuests = await Promise.all(
    //       guest?.sid?.map(async (sid) => {
    //         const message = await client.messages(sid).fetch();
    //         return message;
    //       })
    //     );
    //     guest.sid = populateGuests;
    //     return guest;
    //   })
    // );

    return res.status(200).json({ data: invitations?.invitations });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

module.exports = {
  individualWhatsuppBusinessInvite,
  fetchWhatsappInvitations,
  individualWhatsuppPersonalInvite,
  generateQR,
  bulkWhatsuppPersonalInvite,
  bulkWhatsuppBusinessInvite,
};
