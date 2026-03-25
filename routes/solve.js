// routes/solve.js
// Protected API endpoints for solving doubts

const express = require("express");
const multer = require("multer");
const { solveDoubt } = require("../services/claude");
const { extractTextFromImage } = require("../services/vision");
const { protect } = require("../middleware/auth");
const User = require("../models/User");
const Doubt = require("../models/Doubt");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only JPG, PNG, WEBP images allowed."));
  },
});

const VALID_TABS = ["foundation", "inter-group1", "inter-group2"];

// All solve routes require login
router.use(protect);

// ── POST /api/solve/text ───────────────────────────
router.post("/text", async (req, res) => {
  try {
    const tab = VALID_TABS.includes(req.body.tab) ? req.body.tab : "inter-group1";
    const question = req.body.question?.trim();

    if (!question || question.length < 5) {
      return res.status(400).json({ success: false, error: "Please enter a valid question." });
    }

    const result = await solveDoubt(tab, question);

    // Save to doubt history & increment counter
    await Doubt.create({ userId: req.user.userId, tab, questionText: question, ...result });
    await User.updateOne({ userId: req.user.userId }, { $inc: { totalDoubts: 1 } });

    res.json({ success: true, tab, question, result });
  } catch (error) {
    console.error("Text solve error:", error.message);
    res.status(500).json({ success: false, error: error.message || "Failed to solve. Please try again." });
  }
});

// ── POST /api/solve/image ──────────────────────────
router.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Please upload an image." });
    }

    const tab = VALID_TABS.includes(req.body.tab) ? req.body.tab : "inter-group1";
    const base64Image = req.file.buffer.toString("base64");

    const extractedText = await extractTextFromImage(base64Image, req.file.mimetype);
    const fullQuestion = req.body.question?.trim()
      ? `${extractedText}\n\nExtra context: ${req.body.question.trim()}`
      : extractedText;

    const result = await solveDoubt(tab, fullQuestion);

    await Doubt.create({ userId: req.user.userId, tab, questionText: fullQuestion, hasImage: true, extractedText, ...result });
    await User.updateOne({ userId: req.user.userId }, { $inc: { totalDoubts: 1 } });

    res.json({ success: true, tab, extractedText, result });
  } catch (error) {
    console.error("Image solve error:", error.message);
    res.status(500).json({ success: false, error: error.message || "Failed to process image." });
  }
});

module.exports = router;
