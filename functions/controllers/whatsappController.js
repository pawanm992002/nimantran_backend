const { Event } = require("../models/Event");
const { invitationTracker } = require("../models/InvitationTracker");

let clientInstance;

// const generateQR = async (req, res) => {
//   const { eventId } = req?.query;

//   res.setHeader("Content-Type", "text/event-stream");
//   res.setHeader("Cache-Control", "no-cache");
//   res.setHeader("Connection", "keep-alive");

//   const browserArgs = [
//     '--no-sandbox',
//     '--disable-setuid-sandbox',
//     '--disable-dev-shm-usage',
//     '--disable-accelerated-2d-canvas',
//     '--no-first-run',
//     '--no-zygote',
//     '--disable-gpu',
//   ];

//   // Construct the session path inside the /tmp directory in Firebase Functions
//   const sessionPath = path.join(os.tmpdir(), "whatsapp-session");

//   console.log("Session path set to:", sessionPath);

//   venom
//     .create(
//       `whatsapp-session`,
//       (base64Qrimg) => {
//         res.status(200).write(`qrCode: ${base64Qrimg}\n\n`);
//       },
//       (statusSession) => {
//         res.status(200).write(`status: ${statusSession}\n\n`);
//       },
//       {
//         headless: true,
//         logQR: false,
//         autoClose: 0,
//         session: `whatsapp-session`,
//         multidevice: true,
//         folderNameToken: "tokens", // Folder name for tokens
//         mkdirFolderToken: sessionPath, // Set the session path to /tmp directory
//         createPathFileToken: true, // Allow the creation of token files in the defined folder
//         browserArgs,
//         puppeteer: {
//           executablePath: await chrome.executablePath, // Use chrome-aws-lambda for headless chromium
//         }
//       }
//     )
//     .then((client) => {
//       clientInstance = client;
//       res.status(200).write(`complete: clientScanned\n\n`);

//       const number = "916367703375";
//       const message = "This is Invitation Message";

//       const formattedNumber = `${number}@c.us`;

//       client
//         .sendText(formattedNumber, message)
//         .then((result) => {
//           res.status(200).write(`complete: Message sent\n\n`);
//         })
//         .catch((error) => {
//           res.status(200).write(`error: ${error.message}\n\n`);
//         });
//     })
//     .catch((err) => {
//       res.write(`error: ${err.message}\n\n`);
//     });
// };

// const generateQR = async (req, res) => {
//   const { eventId } = req?.query;
//   const sessionName = `whatsapp-session`;

//   res.setHeader("Content-Type", "text/event-stream");
//   res.setHeader("Cache-Control", "no-cache");
//   res.setHeader("Connection", "keep-alive");

//   const browserArgs = [
//     "--no-sandbox",
//     "--disable-setuid-sandbox",
//     "--disable-dev-shm-usage",
//     "--disable-accelerated-2d-canvas",
//     "--no-first-run",
//     "--no-zygote",
//     "--disable-gpu",
//   ];

//   const sessionPath = path.join(os.tmpdir(), sessionName);

//   try {
//     const executablePath = await chrome.executablePath;

//     venom
//       .create(
//         sessionName,
//         (base64Qrimg) => {
//           res.status(200).write(`qrCode: ${base64Qrimg}\n\n`);
//         },
//         (statusSession) => {
//           res.status(200).write(`status: ${statusSession}\n\n`);
//         },
//         {
//           headless: chrome.headless, // Use chrome-aws-lambda's headless
//           logQR: false,
//           autoClose: 0,
//           session: sessionName,
//           multidevice: true,
//           folderNameToken: "tokens",
//           mkdirFolderToken: sessionPath,
//           createPathFileToken: true,
//           browserArgs,
//           puppeteer: {
//             executablePath: executablePath || "/usr/bin/google-chrome", // Fallback if no chrome executable
//           },
//         }
//       )
//       .then((client) => {
//         clientInstance = client;
//         res.status(200).write(`complete: clientScanned\n\n`);

//         const number = "916367703375";
//         const message = "This is Invitation Message";

//         const formattedNumber = `${number}@c.us`;

//         client
//           .sendText(formattedNumber, message)
//           .then((result) => {
//             res.status(200).write(`complete: Message sent\n\n`);
//           })
//           .catch((error) => {
//             res.status(200).write(`error: ${error.message}\n\n`);
//           });
//       })
//       .catch((err) => {
//         res.status(200).write(`error: ${err.message}\n\n`);
//       });
//   } catch (error) {
//     res.status(500).send(`Error initializing QR generation: ${error.message}`);
//   }
// };

const generateQR = async (req, res) => {
  // const { eventId } = req?.query;
  // const sessionName = `whatsapp-session`;

  // res.setHeader("Content-Type", "text/event-stream");
  // res.setHeader("Cache-Control", "no-cache");
  // res.setHeader("Connection", "keep-alive");

  // const browserArgs = [
  //   "--no-sandbox",
  //   "--disable-setuid-sandbox",
  //   "--disable-dev-shm-usage",
  //   "--disable-accelerated-2d-canvas",
  //   "--no-first-run",
  //   "--no-zygote",
  //   "--disable-gpu",
  // ];

  // const sessionPath = path.join(os.tmpdir(), sessionName);

  // try {
  //   const executablePath = await chrome.executablePath;

  //   venom
  //     .create(
  //       sessionName,
  //       (base64Qrimg) => {
  //         res.write(`qrCode: ${base64Qrimg}\n\n`);
  //         // res.flush();  // Flush the response to avoid timeout
  //       },
  //       (statusSession) => {
  //         res.write(`status: ${statusSession}\n\n`);
  //         // res.flush();  // Flush the response to avoid timeout
  //       },
  //       {
  //         headless: chrome.headless, // Use chrome-aws-lambda's headless
  //         logQR: false,
  //         autoClose: 0,
  //         session: sessionName,
  //         multidevice: true,
  //         mkdirFolderToken: sessionPath, // Save tokens in /tmp
  //         createPathFileToken: true,
  //         folderNameToken: sessionPath, // Important: session tokens must be stored in /tmp
  //         browserArgs,
  //         puppeteer: {
  //           executablePath: executablePath || "/usr/bin/google-chrome", // Fallback if no chrome executable
  //         },
  //       }
  //     )
  //     .then((client) => {
  //       res.write(`complete: clientScanned\n\n`);
  //       // res.flush(); // Flush to prevent Firebase Function timeout

  //       const number = "916367703375";
  //       const message = "This is Invitation Message";

  //       const formattedNumber = `${number}@c.us`;

  //       client
  //         .sendText(formattedNumber, message)
  //         .then((result) => {
  //           res.write(`complete: Message sent\n\n`);
  //           // res.flush();
  //         })
  //         .catch((error) => {
  //           res.write(`error: ${error.message}\n\n`);
  //           // res.flush();
  //         });
  //     })
  //     .catch((err) => {
  //       res.write(`error: ${err.message}\n\n`);
  //       // res.flush();
  //     });
  // } catch (error) {
  //   res.status(400).send(`Error initializing QR generation: ${error.message}`);
  // }
};

const individualWhatsuppPersonalInvite = (req, res) => {
  // const { number } = req.body;
  const message = "hii this is my message";

  console.log(".................", clientInstance);

  // if (!clientInstance) {
  //   return res.status(400).json({ error: "Client not initialized yet" });
  // }

  // const number = "916367703375";

  // const formattedNumber = `${number}@c.us`; // Ensure proper number formatting for WhatsApp

  // clientInstance
  //   .sendText(formattedNumber, message)
  //   .then((result) => {
  //     res.json({ success: true, result });
  //   })
  //   .catch((error) => {
  //     console.error("Error sending message:", error);
  //     res.status(400).json({ error: "Error sending message" });
  //   });
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
