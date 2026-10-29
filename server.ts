import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '5mb' }));

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoints per architecture spec
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/readyz', (_req, res) => {
  res.json({ status: 'ready', mode: process.env.VITE_API_MODE || 'mock', timestamp: new Date().toISOString() });
});

// Assistive AI: Natural-language resource discovery query parser (High Thinking mode with gemini-4-argon)
app.post('/api/ai/parse-query', async (req, res) => {
  try {
    const { query, resourcesSummary } = req.body as {
      query?: string;
      resourcesSummary?: Array<{ id: string; name: string; category: string; description: string; location: string }>;
    };

    if (!query || !query.trim()) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Query is required.' } });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: {
          code: 'AI_UNAVAILABLE',
          message: 'Server-side AI key not configured; client will use deterministic keyword parser.',
        },
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-argon',
      contents: `You are an assistive search parser for an institutional resource-sharing platform (SHARESPACE).
Parse the user's natural-language equipment/space request and match it against the provided catalog summary.
Never make eligibility, approval, or safety clearance decisions—only suggest structured search filters and explain why specific catalog items match the technical need.

User query: "${query}"

Catalog items:
${JSON.stringify(resourcesSummary || [], null, 2)}`,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: 'Matched category: ALL, ELECTRONICS, MEDIA_COMPUTING, or SPACE',
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Extracted technical terms',
            },
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  resourceId: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['resourceId', 'reason'],
              },
            },
            reasoningSummary: {
              type: Type.STRING,
              description: 'Concise plain-language explanation of how the query was interpreted.',
            },
          },
          required: ['category', 'keywords', 'matches', 'reasoningSummary'],
        },
      },
    });

    const text = response.text || '{}';
    res.json(JSON.parse(text));
  } catch (err) {
    res.status(503).json({
      error: {
        code: 'AI_ERROR',
        message: err instanceof Error ? err.message : 'AI service unavailable; falling back to deterministic parser.',
      },
    });
  }
});

// Assistive AI: Incident report draft structuring (High Thinking mode with gemini-4-argon)
app.post('/api/ai/structure-incident', async (req, res) => {
  try {
    const { rawNotes, resourceName } = req.body as { rawNotes?: string; resourceName?: string };
    if (!rawNotes || !rawNotes.trim()) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Notes are required.' } });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: {
          code: 'AI_UNAVAILABLE',
          message: 'Server-side AI key not configured; client will use deterministic report structurer.',
        },
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-argon',
      contents: `You are an assistive incident report structurer for SHARESPACE.
Convert the user's raw observation notes into structured incident fields.
CRITICAL GUARDRAIL: Incident reports are unverified allegations until a human reviewer resolves them. Do NOT assign blame, liability, fault, or penalties. Keep wording neutral and factual.

Resource: "${resourceName || 'Shared Resource'}"
User raw notes: "${rawNotes}"`,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: 'One of: Damage / suspected damage, Missing accessory, Late return, Safety concern, Booking conflict, Other',
            },
            reportedStage: {
              type: Type.STRING,
              description: 'When discovered: Pre-use check-in, During operation, Return inspection, or Post-return review',
            },
            affectedPart: {
              type: Type.STRING,
              description: 'Specific component, probe, cable, lens, or space fixture mentioned',
            },
            structuredDescription: {
              type: Type.STRING,
              description: 'Neutral, factual summary of the observation suitable for technician review without assigning blame',
            },
            suggestedCheckpoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2-3 neutral physical inspection steps for the lab technician',
            },
          },
          required: ['category', 'reportedStage', 'affectedPart', 'structuredDescription', 'suggestedCheckpoints'],
        },
      },
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    res.json({
      ...parsed,
      requiresHumanReview: true,
      source: 'gemini-4-argon (High Thinking)',
    });
  } catch (err) {
    res.status(503).json({
      error: {
        code: 'AI_ERROR',
        message: err instanceof Error ? err.message : 'AI service unavailable; falling back to local structurer.',
      },
    });
  }
});

// Assistive AI: Complex Policy & Fairness Impact Reasoning (High Thinking mode with gemini-4-argon)
app.post('/api/ai/analyze-policy', async (req, res) => {
  try {
    const { policyDraft, resourceContext } = req.body as {
      policyDraft?: Record<string, unknown>;
      resourceContext?: string;
    };

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: {
          code: 'AI_UNAVAILABLE',
          message: 'Server-side AI key not configured; client will use deterministic policy preview.',
        },
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-argon',
      contents: `Analyze this proposed institutional resource-sharing policy version for fairness, potential bottlenecks, and edge cases.
Remember: policies are evaluated deterministically by the server; your analysis is advisory for the administrator before activation.

Proposed policy definition: ${JSON.stringify(policyDraft || {})}
Context: ${resourceContext || 'Campus shared equipment'}`,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            plainLanguageSummary: { type: Type.STRING },
            fairnessConsiderations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            operationalRecommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['plainLanguageSummary', 'fairnessConsiderations', 'operationalRecommendations'],
        },
      },
    });

    const text = response.text || '{}';
    res.json(JSON.parse(text));
  } catch (err) {
    res.status(503).json({
      error: {
        code: 'AI_ERROR',
        message: err instanceof Error ? err.message : 'AI service unavailable.',
      },
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`SHARESPACE server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
