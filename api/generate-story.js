// /api/generate-story.js
// Edge Function — generates a kids' fairytale from a transcript

import OpenAI from "openai";
export const config = { runtime: "edge" };

// 🔒 EXACT origins that are allowed to call this API (no trailing slash)
const ALLOWED_ORIGINS = new Set([
  "https://byunusoglu.github.io", // ← your GitHub Pages origin
  "http://127.0.0.1:5500",        // ← allow local testing with VS Code Live Server (optional)
  "http://localhost:5500"         // ← optional
]);

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
}

export default async function handler(req) {
  const origin = req.headers.get("origin") || "";
  const headers = corsHeaders(origin);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // Health check / quick config echo (helpful in browser)
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        route: "/api/generate-story",
        origin,
        allowed: ALLOWED_ORIGINS.has(origin),
        hasOpenAIKey: !!process.env.OPENAI_API_KEY
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  try {
    // Parse body
    const body = await req.json().catch(() => ({}));
    const transcript = (body.transcript || "").toString().trim();
    const language = (body.language || "en-GB").toString(); // hint; auto-detect anyway

    // Early guards
    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response(JSON.stringify({ error: "CORS_ORIGIN_DENIED", origin }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    if (!transcript) {
      return new Response(JSON.stringify({ error: "TRANSCRIPT_MISSING" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY_NOT_SET" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Prompts
    const systemPrompt = `
You write short, soothing fairytales for ages 3–6. Use simple sentences, warm tone, gentle humor.
Length ~400–700 words (~3–5 minutes read). No scary or violent content.
If names/themes/places are in the transcript, weave them in naturally.
Return clean markdown with:
- A Title
- 3–6 very short sections with tiny headings (e.g., "The Forest Path")
- Some calm onomatopoeia ("plip-plop", "whoosh")
- A reassuring bedtime-style ending.
If the transcript is Turkish, write fully in Turkish with the same rules.
`.trim();

    const userPrompt = `
PARENT + CHILD PRE-STORY CONVERSATION (raw transcript):
---
${transcript}
---

TASK:
1) Detect language automatically (prefer "${language}" if unsure).
2) Write a brand-new fairytale for a 3–6 year-old using the ideas above.
3) Output clean markdown only (no code fences).
`.trim();

    // Call OpenAI (Responses API)
    const resp = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const story = resp.output_text || "Sorry, I couldn’t create the story.";

    return new Response(JSON.stringify({ story }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  } catch (err) {
    // Log internally; return safe error
    console.error("generate-story error:", err);
    return new Response(JSON.stringify({ error: "SERVER_ERROR" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }
}
