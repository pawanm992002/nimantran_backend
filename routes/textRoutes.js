const { saveText, getTexts } = require("../controllers/textController");

const router = require("express").Router();

router.post("/texts/save", saveText);
router.get("/texts/get", getTexts);

module.exports = router;
