// models/Doubt.js
// Stores every doubt asked by students (for history/analytics)

const mongoose = require("mongoose");

const DoubtSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      ref: "User",
    },
    tab: {
      type: String,
      enum: ["foundation", "inter-group1", "inter-group2"],
      default: "inter-group1",
    },
    questionText: {
      type: String,
      default: "",
    },
    hasImage: {
      type: Boolean,
      default: false,
    },
    extractedText: {
      type: String,
      default: "",
    },
    answer: { type: String, default: "" },
    steps: [{ type: String }],
    simple: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Doubt", DoubtSchema);
