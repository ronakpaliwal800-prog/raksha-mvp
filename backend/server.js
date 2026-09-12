require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

/*
========================================================
RAKSHA V3 — AI SCAM GUARDIAN
India-focused multimodal scam detection
========================================================
*/

const SYSTEM_PROMPT = `
You are RAKSHA, an AI scam-safety assistant designed for people in India.

Your mission:
Protect ordinary users, elderly people, students, workers and families from
financial scams, phishing, impersonation, fake calls, fake messages and social engineering.

You may receive:
1. Text messages
2. Screenshots/images
3. Audio/voice recordings
4. A combination of these

Analyze EVERYTHING supplied.

IMPORTANT:
Do not automatically call something a scam just because it looks unusual.
Distinguish between:
- SCAM = strong evidence of fraud or malicious intent
- SUSPICIOUS = meaningful warning signs but insufficient evidence
- SAFE = no meaningful scam indicators detected

Never claim that a message is guaranteed safe.

========================================================
INDIA-SPECIFIC SCAM TYPES
========================================================

Identify these when applicable:

1. Bank/KYC phishing
2. UPI/payment fraud
3. OTP/PIN theft
4. Fake customer care
5. Fake job/recruitment
6. Courier/customs scam
7. Electricity disconnection scam
8. Government impersonation
9. Police/legal-threat scam
10. Investment/crypto scam
11. Refund scam
12. Lottery/prize scam
13. Relative/family emergency scam
14. Romance/social engineering scam
15. Phishing/link scam
16. Remote-access/device takeover
17. Loan/credit scam
18. SIM/mobile/KYC scam
19. AI voice impersonation
20. Other fraud

========================================================
RED FLAGS
========================================================

Look for observable signals such as:

- Urgency or artificial deadline
- Threat of account closure
- Threat of legal action
- Request for OTP
- Request for PIN/password
- Request for UPI PIN
- Request to transfer money
- Unknown payment recipient
- Suspicious URL/domain
- Fake bank/customer-care identity
- Fake government identity
- Fake employment offer
- Too-good-to-be-true financial promise
- Request to install remote-access software
- Request to share screen
- Request for personal documents
- Emotional manipulation
- Fear/panic manipulation
- Secrecy request
- Voice impersonation
- Caller pretending to be relative
- Payment-before-service demand
- Unusual spelling/domain mismatch
- Cryptocurrency/payment wallet request

Only mention red flags actually supported by the supplied content.

========================================================
RISK SCORE
========================================================

Return a number from 0 to 100.

Suggested interpretation:

0-20   = very low risk
21-40  = low risk
41-60  = moderate risk
61-80  = high risk
81-100 = very high risk

Strong combinations of:
impersonation + urgency + payment request + suspicious link
should generally produce a high score.

========================================================
SIGNAL ANALYSIS
========================================================

For each important signal return:

name
level: HIGH / MEDIUM / LOW
reason

The reason must explain what was actually observed.

========================================================
ACTION PLAN
========================================================

Give short practical actions.

Never tell the user to:
- click a suspicious link
- call a suspicious number
- send money
- share OTP
- share PIN
- install unknown software

For suspected scams, prioritize:

1. Stop communication
2. Do not click links
3. Do not send money
4. Do not share OTP/PIN/password
5. Verify using an official source
6. Contact bank/payment provider if relevant
7. Tell a trusted family member
8. Report fraud if money/details were already lost

========================================================
ELDER MODE
========================================================

Write an extremely simple explanation for an elderly person.

Example style:

"This looks like a scam. Do not click the link. Do not send money.
Do not tell anyone your OTP. Ask a family member to check it."

========================================================
HINDI MODE
========================================================

Write simple Hindi using Devanagari.

Example:

"यह संदेश धोखाधड़ी हो सकता है। लिंक पर क्लिक न करें।
पैसे न भेजें और OTP या PIN किसी को न बताएं।"

========================================================
AUDIO
========================================================

If audio is supplied:
- Analyze the spoken content
- Look for impersonation
- Look for urgency
- Look for money/payment requests
- Look for OTP/PIN/password requests
- Look for threats
- Look for AI voice impersonation indicators

Do NOT claim that a voice is AI-generated with certainty.
Use wording such as "possible voice impersonation" when evidence is insufficient.

========================================================
OUTPUT
========================================================

Return ONLY valid JSON.

Use exactly these fields:

{
  "verdict": "SCAM" | "SUSPICIOUS" | "SAFE",
  "riskScore": number,
  "confidence": number,
  "scamType": string,
  "summary": string,
  "redFlags": string[],
  "signals": [
    {
      "name": string,
      "level": "HIGH" | "MEDIUM" | "LOW",
      "reason": string
    }
  ],
  "actions": string[],
  "elderExplanation": string,
  "hindiExplanation": string,
  "familyAlert": boolean,
  "familyAlertReason": string
}

familyAlert should be true only when the situation appears dangerous enough
that involving a trusted family member immediately would be appropriate.

Do not invent facts.
`;

function cleanJson(text) {
  let cleaned = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start >= 0 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  return JSON.parse(cleaned);
}

function normalizeResult(result) {
  const validVerdicts = ['SCAM', 'SUSPICIOUS', 'SAFE'];

  if (!validVerdicts.includes(result.verdict)) {
    result.verdict = 'SUSPICIOUS';
  }

  result.riskScore = Math.max(
    0,
    Math.min(100, Number(result.riskScore) || 0)
  );

  result.confidence = Math.max(
    0,
    Math.min(100, Number(result.confidence) || 0)
  );

  if (!Array.isArray(result.redFlags)) {
    result.redFlags = [];
  }

  if (!Array.isArray(result.signals)) {
    result.signals = [];
  }

  if (!Array.isArray(result.actions)) {
    result.actions = [];
  }

  if (typeof result.familyAlert !== 'boolean') {
    result.familyAlert = result.riskScore >= 85;
  }

  result.familyAlertReason =
    result.familyAlertReason ||
    'A trusted family member should verify this situation before any payment or sensitive information is shared.';

  return result;
}

/*
========================================================
HEALTH CHECK
========================================================
*/

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    model: MODEL,
    provider: 'Google Gemini',
    geminiConfigured: !!GEMINI_API_KEY
  });
});

/*
========================================================
ANALYZE
========================================================
*/

app.post('/api/analyze', async (req, res) => {
  try {
    const {
      text,
      imageBase64,
      imageMediaType,
      audioBase64,
      audioMediaType
    } = req.body || {};

    if (!text && !imageBase64 && !audioBase64) {
      return res.status(400).json({
        error: 'Provide text, screenshot, or audio.'
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Server missing GEMINI_API_KEY. Add it to backend/.env'
      });
    }

    const parts = [];

    /*
    Screenshot
    */
    if (imageBase64) {
      parts.push({
        inline_data: {
          mime_type: imageMediaType || 'image/jpeg',
          data: imageBase64
        }
      });
    }

    /*
    Voice recording
    */
    if (audioBase64) {
      parts.push({
        inline_data: {
          mime_type: audioMediaType || 'audio/webm',
          data: audioBase64
        }
      });
    }

    /*
    User text
    */
    if (text) {
      parts.push({
        text: `
USER-SUPPLIED TEXT:

${text}

Analyze this content for scam/fraud indicators.
`
      });
    } else if (imageBase64 && audioBase64) {
      parts.push({
        text: `
Analyze the supplied screenshot and audio together.
Look for contradictions, impersonation, payment requests,
urgency and other scam signals.
`
      });
    } else if (imageBase64) {
      parts.push({
        text: `
Analyze this screenshot for scam/fraud indicators.
Read visible text, links, names, payment requests and threats.
`
      });
    } else {
      parts.push({
        text: `
Analyze this audio recording for scam/fraud indicators.
Pay particular attention to impersonation, urgency,
money requests, OTP/PIN requests and threats.
`
      });
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(MODEL)}:generateContent?key=` +
      `${encodeURIComponent(GEMINI_API_KEY)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: SYSTEM_PROMPT
            }
          ]
        },

        contents: [
          {
            role: 'user',
            parts
          }
        ],

        generationConfig: {
          temperature: 0.15,
          responseMimeType: 'application/json',

          responseSchema: {
            type: 'OBJECT',

            properties: {
              verdict: {
                type: 'STRING',
                enum: [
                  'SCAM',
                  'SUSPICIOUS',
                  'SAFE'
                ]
              },

              riskScore: {
                type: 'NUMBER'
              },

              confidence: {
                type: 'NUMBER'
              },

              scamType: {
                type: 'STRING'
              },

              summary: {
                type: 'STRING'
              },

              redFlags: {
                type: 'ARRAY',
                items: {
                  type: 'STRING'
                }
              },

              signals: {
                type: 'ARRAY',

                items: {
                  type: 'OBJECT',

                  properties: {
                    name: {
                      type: 'STRING'
                    },

                    level: {
                      type: 'STRING',
                      enum: [
                        'HIGH',
                        'MEDIUM',
                        'LOW'
                      ]
                    },

                    reason: {
                      type: 'STRING'
                    }
                  },

                  required: [
                    'name',
                    'level',
                    'reason'
                  ]
                }
              },

              actions: {
                type: 'ARRAY',
                items: {
                  type: 'STRING'
                }
              },

              elderExplanation: {
                type: 'STRING'
              },

              hindiExplanation: {
                type: 'STRING'
              },

              familyAlert: {
                type: 'BOOLEAN'
              },

              familyAlertReason: {
                type: 'STRING'
              }
            },

            required: [
              'verdict',
              'riskScore',
              'confidence',
              'scamType',
              'summary',
              'redFlags',
              'signals',
              'actions',
              'elderExplanation',
              'hindiExplanation',
              'familyAlert',
              'familyAlertReason'
            ]
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        'Gemini API error:',
        errorText
      );

      return res.status(502).json({
        error: 'AI service error',
        details: errorText
      });
    }

    const data = await response.json();

    const raw =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('') || '';

    if (!raw) {
      console.error(
        'Gemini response:',
        JSON.stringify(data, null, 2)
      );

      return res.status(502).json({
        error: 'Gemini returned no analysis.'
      });
    }

    const result = normalizeResult(
      cleanJson(raw)
    );

    console.log(
      `RAKSHA: ${result.verdict} | ${result.riskScore}/100 | ${result.scamType}`
    );

    res.json(result);

  } catch (error) {

    console.error(
      'RAKSHA server error:',
      error
    );

    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/*
========================================================
START SERVER
========================================================
*/

app.listen(PORT, () => {
  console.log('');
  console.log('====================================');
  console.log('🛡️ RAKSHA V3 BACKEND');
  console.log('====================================');
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`🤖 Gemini Model: ${MODEL}`);
  console.log(`🔑 API Key: ${GEMINI_API_KEY ? 'Configured' : 'MISSING'}`);
  console.log('====================================');
  console.log('');
});