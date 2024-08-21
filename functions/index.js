const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const textRoutes = require("./routes/textRoutes")

const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const clientRoutes = require("./routes/clientRoutes");
const adminRoutes = require("./routes/adminRoutes");
const customerRoutes = require("./routes/customerRoutes");
const cardRoutes = require("./routes/cardImage");
const videoRoutes = require("./routes/videoRoutes");
const PdfRoutes = require("./routes/cardPdf");
const eventRoutes = require("./routes/eventRoutes");
const transictionRoutes = require("./routes/TransictionRoutes");
const whatsappRoutes = require("./routes/whatSuppRoutes");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());
app.use("/tmp", express.static("tmp"));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json("server started .........");
});

app.use("/api/admin", adminRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/transictions", transictionRoutes);
app.use("/api/whatsapp", whatsappRoutes);

app.use("/api/videoEdit", videoRoutes);
app.use("/api/imageEdit", cardRoutes);
app.use("/api/pdfEdit", PdfRoutes);
app.use("/api/",textRoutes)

app.listen(8000, () => {
    console.log("listening")
})

// exports.app = functions
//   .runWith({ timeoutSeconds: 540, memory: '8GB' })
//   .https.onRequest(app);
