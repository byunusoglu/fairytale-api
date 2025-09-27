import OpenAI from "openai";

export const config = {
  runtime: "edge",
};

const ALLOWED_ORIGIN = "https://<your-username>.github.io"; // change this!

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Only POST allowed", { status: 405 });
  }

  const { transcript } = await req.json();
  if (!transcript) {
    return new Response("Transcript missing", { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You write short, safe fairytales for kids aged 3–6. Simple language, friendly tone, 3–5 minute read.",
      },
      { role: "user", content: transcript },
    ],
  });

  return new Response(JSON.stringify({ story: response.output_text }), {
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Content-Type": "application/json",
    },
  });
}
