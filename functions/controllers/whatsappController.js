const twilio = require("twilio"); // for business messages
const { Event } = require("../models/Event");
// const { Client, MessageMedia } = require("whatsapp-web.js"); // for personal messages
// const qrcode = require("qrcode");
const { invitationTracker } = require("../models/InvitationTracker");
const venom = require("venom-bot");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// let clientPersonal;

let clientInstance; // This will hold the WhatsApp client instance
let qrCodeData = ""; // Store the QR code data temporarily to send to the client

const generateQR = (req, res) => {
  if (clientInstance) {
    // If the client is already initialized, no need to generate a new QR code
    return res.json({ qr: qrCodeData });
  }

  venom
    .create(
      {
        session: "whatsapp-session",
        multidevice: true,
        headless: true, // Set to true for Firebase Functions
        useChrome: false, // Must be false in Firebase Functions
        disableSpins: true,
        disableWelcome: true,
      },
      (base64Qrimg, asciiQR, attempts, urlCode) => {
        console.log("Number of attempts to read QR:", attempts);
        qrCodeData = base64Qrimg; // Save QR code data as base64 string
        // You can use ASCII QR code if you want it to be printed in the console
        console.log("QR Code in ASCII:", asciiQR);
      },
      undefined, // No options for callbacks on session creation failure
      { multidevice: true } // Options (use multi-device, optional)
    )
    .then((client) => {
      clientInstance = client;
      console.log("Client initialized successfully!");
      res.json({ qr: qrCodeData });
    })
    .catch((error) => {
      console.error("Error initializing venom-bot:", error);
      res.status(500).json({ error: "Error generating QR code" });
    });
};

const individualWhatsuppPersonalInvite = (req, res) => {
  // const { number } = req.body;
  const message = "hii this is my message";

  console.log(".................", clientInstance);

  if (!clientInstance) {
    return res.status(400).json({ error: "Client not initialized yet" });
  }

  const number = "916367703375";

  const formattedNumber = `${number}@c.us`; // Ensure proper number formatting for WhatsApp

  clientInstance
    .sendText(formattedNumber, message)
    .then((result) => {
      res.json({ success: true, result });
    })
    .catch((error) => {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Error sending message" });
    });
};

const bulkWhatsuppPersonalInvite = async (req, res) => {
  // try {
  //   if (!clientPersonal?.info || !clientPersonal?.info?.wid) {
  //     throw new Error("WhatsApp client is not ready yet. Try Again");
  //   }
  //   const { eventId } = req.query;
  //   const guests = await Event.findById(eventId)?.select("guests");
  //   const invitations = await Promise.all(
  //     guests?.guests?.map(async (guest) => {
  //       const chatId = `${guest?.mobileNumber}@c.us`;
  //       const caption = "This is a Invitation Message";
  //       const mediaUrl = guest.link;
  //       // Fetch the media from the Firebase URL
  //       const media = await MessageMedia.fromUrl(mediaUrl);
  //       // Send the media with an optional caption
  //       const response = await clientPersonal?.sendMessage(chatId, media, {
  //         caption,
  //       });
  //       return {
  //         from: response.from,
  //         to: response.to,
  //         mediaType: response.type,
  //         status: "sended", // ["sended", "notSended", "queued"]
  //       };
  //     })
  //   );
  //   if (!invitations) throw new Error("Something Wrong");
  //   const isInvitationsExits = await invitationTracker.findOneAndUpdate(
  //     { eventId },
  //     {
  //       $push: { invitations: invitations },
  //     }
  //   );
  //   if (!isInvitationsExits) {
  //     const newInvitations = new invitationTracker({
  //       eventId,
  //       invitations,
  //     });
  //     await newInvitations.save();
  //   }
  //   res
  //     .status(200)
  //     .json({ message: "Invitations are sended", data: invitations });
  // } catch (error) {
  //   res.status(400).json({ message: error.message });
  // }
};

const individualWhatsuppBusinessInvite = async (req, res) => {
  try {
    let { mobileNumber, link } = req.body;
    const { eventId } = req.query;
    mobileNumber =
      mobileNumber?.at(0) === "+" ? mobileNumber : "+" + mobileNumber;

    // const messageResp = await client.messages.create({
    //   from: "whatsapp:+916378755023",
    //   to: `whatsapp:${mobileNumber}`,
    //   body: `This is a Invitation from {{1}}`, // For template, this is not used. Add in the template parameters instead.
    //   // WhatsApp template parameters
    //   // messagingServiceSid: 'your_messaging_service_sid', // Optional if set
    //   contentSid: "HX7e367ed7f0c83ad7e72f241c4399357c", // Use the template SID
    //   contentVariables: JSON.stringify({
    //     1: "Pawan", // Replaces {{1}} with 'Your Company Name'
    //   }),
    // });

    // const mediaUrl =
    //   "https://firebasestorage.googleapis.com/v0/b/nimantran-test.appspot.com" +
    //   link
    //     ?.split(
    //       "https://firebasestorage.googleapis.com/v0/b/nimantran-test.appspot.com"
    //     )
    //     ?.at(1);

    const messageResp = await client.messages.create({
      from: "whatsapp:+916378755023",
      to: `whatsapp:${mobileNumber}`,
      body: `This is a Invitation from {{1}}`, // For template, this is not used. Add in the template parameters instead.
      // messagingServiceSid: 'your_messaging_service_sid', // Optional if set
      contentSid: "HXc817986fdd37fbb70f6b2982163fcb1b", // Use the template SID
      // mediaUrl: `https://firebasestorage.googleapis.com/v0/b/nimantran-test.appspot.com{{3}}`,
      mediaUrl: link,
      contentVariables: JSON.stringify({
        1: "kushagra", // Replaces {{1}} with 'Your Company Name'
        // 3: link
        //   ?.split(
        //     "https://firebasestorage.googleapis.com/v0/b/nimantran-test.appspot.com"
        //   )
        //   ?.at(1),
      }),
    });

    console.log("..........", messageResp);

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

// /////////////////////////////////////////////////////////////////////////////////////////
// const chromium = require('chrome-aws-lambda');
// const { Client } = require('whatsapp-web.js');
// const qrcode = require('qrcode');

// const generateQR = async (req, res) => {
//   try {
//     const executablePath = await chromium.executablePath;

//     const clientPersonal = new Client({
//       puppeteer: {
//         headless: true,
//         args: chromium.args,
//         executablePath: executablePath,
//         defaultViewport: chromium.defaultViewport,
//       },
//       session: null,
//     });

//     clientPersonal.on("qr", (qr) => {
//       qrcode.toDataURL(qr, (err, url) => {
//         if (err) {
//           return res.status(400).send({ message: 'Error generating QR code' });
//         }
//         res.status(200).send({ qrCode: url });
//       });
//     });

//     await clientPersonal.initialize();
//   } catch (error) {
//     res.status(500).send({ message: 'Error initializing client', error: error.toString() });
//   }
// };

// module.exports = generateQR;
