// api/generate-story.js
import OpenAI from "openai";

export const config = {
  runtime: "edge", // fast, low-latency on Vercel’s Edge Runtime
};

// Allow your GitHub Pages site to call this API (CORS)
const ALLOWED_ORIGIN = "https://<your-username>.github.io"; // ← change this

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: corsHeaders({ "Content-Type": "application/json" }),
    });
  }

  try {
    const body = await req.json();
    const transcript = (body?.transcript || "").toString().trim();
    const language = (body?.language || "en-GB").toString();

    if (!transcript) {
      return new Response(JSON.stringify({ error: "Missing transcript" }), {
        status: 400,
        headers: corsHeaders({ "Content-Type": "application/json" }),
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Prompt engineered for a gentle, 3–5 minute read, age ~3–6
    const systemPrompt = `
You write short, soothing fairytales for ages 3–6. Use simple sentences, warm tone, kind humor.
Never include scary or violent content. Keep it ~400–700 words (3–5 minutes slow read).
If the transcript mentions names, themes, or places, weave them in naturally.
Add soft structure:
- Title
- 3–6 short sections with tiny headings (e.g., "The Forest Path")
- Occasional onomatopoeia ("plip-plop", "whoosh") and gentle repetition kids love.
- A calm, reassuring ending and a little "goodnight-style" closing line.
If the language is Turkish, write fully in Turkish with the same rules.
    `.trim();

    const userPrompt = `
PARENT+CHILD PRE-STORY CONVERSATION (raw transcript):
---
${transcript}
---

TASK:
1) Detect language (English UK or Turkish are common) based on transcript; prefer "${language}" if ambiguous.
2) Write a brand-new fairytale strictly for a 3–6 year-old.
3) Respect the child's choices (character names, creatures, places, items, special events).
4) No brand names, no ads, no unsafe themes.
5) Output as clean, reader-friendly markdown.
    `.trim();

    // Call the OpenAI Responses API (modern replacement for Chat Completions)
    const resp = await openai.responses.create({
      model: "gpt-4.5", // or "gpt-5" if you have access
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    // Unified text accessor (SDK exposes .output_text for convenience)
    const story = resp.output_text ?? "Sorry, I couldn’t create the story.";

    return new Response(JSON.stringify({ story }), {
      status: 200,
      headers: corsHeaders({ "Content-Type": "application/json" }),
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: corsHeaders({ "Content-Type": "application/json" }),
    });
  }
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...extra,
  };
}
