const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: GEMINI_API_KEY is missing from .env");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    ai: "Gemini",
  });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: "Please provide text to analyze.",
      });
    }

    const prompt = `
You are RAKSHA, an AI-powered scam detection and safety system
designed to protect people from digital fraud.

Analyze the following message carefully.

MESSAGE:
"""
${text}
"""

Your job is NOT simply to say "scam" or "safe".

Think like a skeptical investigator.

Check for:
- Urgency or pressure tactics
- Requests for OTP, PIN, passwords, money or personal information
- Fake bank/KYC/account-blocking threats
- Suspicious links
- Impersonation
- Fake job offers
- Refund scams
- UPI/payment scams
- Emotional manipulation
- Authority impersonation
- Too-good-to-be-true promises

Then challenge your own conclusion:

"What would need to be true for this message to be legitimate?"

Return ONLY valid JSON in exactly this format:

{
  "verdict": "SCAM" | "SUSPICIOUS" | "LIKELY_SAFE",
  "riskScore": 0,
  "summary": "Short explanation in simple language",
  "redFlags": [
    "flag 1",
    "flag 2"
  ],
  "legitimacyCheck": "What would need to be true for this to be legitimate?",
  "recommendedAction": "Clear action the user should take"
}

Rules:
- riskScore must be between 0 and 100.
- Do not claim certainty without evidence.
- If uncertain, use SUSPICIOUS.
- Use simple language suitable for elderly and non-technical users.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    let resultText = response.text;

    // Remove markdown code fences if Gemini adds them
    resultText = resultText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let analysis;

    try {
      analysis = JSON.parse(resultText);
    } catch (error) {
      console.error("Gemini returned invalid JSON:", resultText);

      analysis = {
        verdict: "SUSPICIOUS",
        riskScore: 50,
        summary: resultText,
        redFlags: [],
        legitimacyCheck:
          "The AI response could not be fully structured, so verify independently.",
        recommendedAction:
          "Do not share money, OTP, passwords, or personal information until independently verified."
      };
    }

    res.json(analysis);

  } catch (error) {
    console.error("Gemini API Error:", error);

    res.status(500).json({
      error: "AI service error",
      details: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🛡️ RAKSHA backend running on http://localhost:${PORT}`);
  console.log("🤖 AI Provider: Google Gemini");
});