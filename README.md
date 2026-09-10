# RAKSHA — AI Scam Checker

A WhatsApp-style AI assistant that detects scam messages, screenshots, and fraud attempts. Built for the "Build in AI for India" hackathon.

## What's included
- `backend/` — Node.js + Express server that calls the Claude API to analyze messages/screenshots for fraud
- `frontend/index.html` — a self-contained WhatsApp-look-alike chat UI (no build step, just open in a browser)
- `backend/sample-messages.txt` — 10 test messages (scam + safe + borderline) for your demo

## Setup (takes ~5 minutes)

### 1. Get an Anthropic API key
Sign up / log in at https://console.anthropic.com and create an API key.

### 2. Install backend dependencies
```bash
cd backend
npm install
```

### 3. Add your API key
```bash
cp .env.example .env
```
Open `.env` and paste your key:
```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
PORT=3000
```

### 4. Start the backend
```bash
npm start
```
You should see: `RAKSHA backend running on http://localhost:3000`

### 5. Open the frontend
Just open `frontend/index.html` directly in your browser (double-click it, or drag it into a browser tab).
The chat UI is pre-configured to talk to `http://localhost:3000/api/analyze` — no changes needed if you're running everything locally.

## How to test it
1. Open `backend/sample-messages.txt`
2. Copy a scam example (e.g. the fake SBI KYC message) into the chat input and hit send
3. Watch RAKSHA respond with a verdict, confidence score, red flags, and what to do next
4. Try a screenshot: take a screenshot of any of the sample text, attach it via the 📎 button, and send

## For your demo/pitch video
- Use 1-2 of the strongest scam examples you've already tested and confirmed work well
- Show one SAFE example too, to prove RAKSHA doesn't just flag everything
- If you added voice-scam detection separately, mention it as a live feature or roadmap item — don't force a shaky live demo

## Notes for judges / extending this
- Currently uses Claude's vision capability directly for screenshots — no separate OCR service needed
- To go to production: connect this backend to the WhatsApp Business API instead of a web chat UI, add a fraud-pattern database for cross-referencing known scam UPI IDs/numbers, and add rate limiting
- The system prompt (in `backend/server.js`) is the core IP — tune it further with more real Indian scam examples for higher accuracy
