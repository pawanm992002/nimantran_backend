 const { saveText ,getTexts, uploadFile} = require("../controllers/textController");
const { authenticateJWT } = require("../middleware/auth");
const { fileParser } = require("express-multipart-file-parser");

const router = require("express").Router();

router.post("/texts/save",saveText)
router.get("/texts/get",getTexts)
router.post("/texts/image",fileParser({ rawBodyOptions: { limit: "500mb" } }),uploadFile)

module.exports = router;
