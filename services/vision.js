// services/vision.js
// Google Cloud Vision API — extracts text from uploaded images

const axios = require("axios");

async function extractTextFromImage(base64Image, mimeType = "image/jpeg") {
  if (!process.env.GOOGLE_VISION_API_KEY) {
    throw new Error("Google Vision API key missing. Add GOOGLE_VISION_API_KEY to .env file.");
  }

  const response = await axios.post(
    `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
    {
      requests: [{
        image: { content: base64Image },
        features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
        imageContext: { languageHints: ["en", "hi"] },
      }],
    }
  );

  const result = response.data.responses[0];
  if (result.error) throw new Error(`Vision API error: ${result.error.message}`);

  const text = result.fullTextAnnotation?.text;
  if (!text || text.trim() === "") {
    throw new Error("No text found in image. Please upload a clearer photo.");
  }

  return text.trim();
}

module.exports = { extractTextFromImage };
