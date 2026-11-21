// SceneCraft — optional AI server function (Vercel / Node 18+).
// Keys live in environment variables on the server and never reach the browser.
//
// TEXT (storyboard proposals + Prompt Assistant) — the first one that is set is used:
//   GEMINI_API_KEY      free tier from Google AI Studio      (GEMINI_MODEL, default gemini-flash-latest)
//   GROQ_API_KEY        free tier from console.groq.com      (GROQ_MODEL, default llama-3.3-70b-versatile)
//   ANTHROPIC_API_KEY   paid                                  (ANTHROPIC_MODEL, default claude-sonnet-5-5)
//   TEXT_PROVIDER       optional: "gemini" | "groq" | "anthropic" to force one
//
// IMAGES (storyboard image generation):
//   OPENAI_API_KEY      paid                                  (OPENAI_IMAGE_MODEL, default gpt-image-1)
//   otherwise Pollinations.ai — free, works without a key (rate-limited; may add a watermark).
//   POLLINATIONS_API_KEY optional free key from enter.pollinations.ai for higher limits.
//   POLLINATIONS=off    turns the free image service off.

const TEXT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function textProvider() {
  const forced = (process.env.TEXT_PROVIDER || "").toLowerCase();
  const has = { gemini: !!process.env.GEMINI_API_KEY, groq: !!process.env.GROQ_API_KEY, anthropic: !!process.env.ANTHROPIC_API_KEY };
  if (forced && has[forced]) return forced;
  return has.gemini ? "gemini" : has.groq ? "groq" : has.anthropic ? "anthropic" : null;
}
function imageProvider() {
  if (process.env.OPENAI_API_KEY) return "openai";
  if ((process.env.POLLINATIONS || "").toLowerCase() === "off") return null;
  return "pollinations";
}
const LABEL = { gemini: "Gemini (free tier)", groq: "Groq (free tier)", anthropic: "Claude", openai: "OpenAI", pollinations: "Pollinations (free)" };

function parseJSON(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("The model didn't return JSON.");
  return JSON.parse(text.slice(a, b + 1));
}

async function gemini(system, user, maxTokens) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens, temperature: 0.7 },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Gemini API error ${r.status}`);
  return parseJSON((j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join(""));
}

async function groq(system, user, maxTokens) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: GROQ_MODEL, max_tokens: maxTokens, temperature: 0.7, response_format: { type: "json_object" },
      messages: [{ role: "system", content: system + "\nRespond with a single JSON object." }, { role: "user", content: user }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Groq API error ${r.status}`);
  return parseJSON(j.choices?.[0]?.message?.content || "");
}

async function llm(system, user, maxTokens) {
  const p = textProvider();
  if (p === "gemini") return gemini(system, user, maxTokens);
  if (p === "groq") return groq(system, user, maxTokens);
  if (p === "anthropic") return claude(system, user, maxTokens);
  throw new Error("No text AI key is set on the server (GEMINI_API_KEY, GROQ_API_KEY or ANTHROPIC_API_KEY).");
}

const FRAMINGS = ["Extreme Wide Shot", "Wide Shot", "Medium Shot", "Close-Up", "Extreme Close-Up", "Over-the-Shoulder", "POV"];
const MOVES = ["Static", "Dolly In", "Dolly Out", "Pan Left", "Pan Right", "Tilt Up", "Tilt Down", "Tracking Shot", "Orbit", "Crane", "Handheld"];
const LIGHTS = ["Natural Daylight", "Golden Hour", "Sunset", "Moonlight", "Soft Studio Lighting", "Dramatic Low-Key", "Neon Night", "Pre-Dawn"];
const MOODS = ["Peaceful", "Dramatic", "Mysterious", "Romantic", "Intense", "Melancholic", "Hopeful", "Tense"];
const TIMES = ["Dawn", "Morning", "Midday", "Afternoon", "Golden Hour", "Dusk", "Night", "Midnight"];

const cut = (s, n) => String(s ?? "").slice(0, n);

async function claude(system, user, maxTokens = 4000) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: TEXT_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Anthropic API error ${r.status}`);
  return parseJSON((j.content || []).filter((c) => c.type === "text").map((c) => c.text).join(""));
}

async function storyboard(body) {
  const shots = { simple: 8, balanced: 6, cinematic: 4 }[body.complexity] || 6;
  const count = Math.max(3, Math.min(24, Math.round((Number(body.duration) || 30) / shots)));
  const system = `You are a film director planning a short AI-generated film. Reply with JSON only, no prose. Schema:
{"title":string,"logline":string,"characters":[{"name":string,"description":string,"hair":string,"clothes":string}],
 "locations":[{"name":string,"description":string,"architecture":string}],
 "scenes":[{"title":string,"summary":string,"shots":[{"title":string,"description":string,"duration":number,"framing":string,"movement":string,"lighting":string,"mood":string,"timeOfDay":string,"motion":string,"characters":[string],"location":string}]}]}
Rules: framing must be one of ${FRAMINGS.join(", ")}. movement one of ${MOVES.join(", ")}. lighting one of ${LIGHTS.join(", ")}. mood one of ${MOODS.join(", ")}. timeOfDay one of ${TIMES.join(", ")}.
Shot durations are whole seconds between 3 and 10. Use about ${count} shots in total across 1-3 scenes, and make durations add up to roughly ${body.duration} seconds.
Character and location names in shots must match the lists exactly. Descriptions are one or two plain sentences of visible action. Keep characters visually specific so they can stay consistent.`;
  const user = `Concept: ${cut(body.concept, 2000)}\nGenre: ${cut(body.genre, 60)}\nFilm style: ${cut(body.filmStyle, 60)}\nAspect ratio: ${cut(body.aspect, 10)}`;
  return llm(system, user, 6000);
}

async function assist(body) {
  const system = `You revise video-generation prompts for a film pre-production tool. Reply with JSON only:
{"prompt": string, "summary": string, "changes": {"framing"?: string, "movement"?: string, "lighting"?: string, "mood"?: string, "timeOfDay"?: string, "motion"?: string}}
"prompt" is the full revised prompt. "summary" is one sentence saying what you changed. Only include a key in "changes" when the request changes that setting; values must come from these lists —
framing: ${FRAMINGS.join(", ")}; movement: ${MOVES.join(", ")}; lighting: ${LIGHTS.join(", ")}; mood: ${MOODS.join(", ")}; timeOfDay: ${TIMES.join(", ")}; motion is free text.
Never remove or alter these locked details: ${(body.locked || []).map((x) => cut(x, 80)).join("; ") || "none"}. Keep every character's appearance and wardrobe text exactly as written.`;
  const user = `Current prompt:\n${cut(body.prompt, 6000)}\n\nShot settings: ${cut(JSON.stringify(body.shot || {}), 2000)}\n\nRequested change: ${cut(body.request, 600)}`;
  return llm(system, user, 2500);
}

async function pollinations(body) {
  const [w, h] = body.aspect === "9:16" ? [768, 1344] : body.aspect === "1:1" ? [1024, 1024] : body.aspect === "2.39:1" ? [1536, 640] : [1344, 768];
  const q = new URLSearchParams({ width: String(w), height: String(h), model: "flux", nologo: "true", seed: String(Math.floor(Math.random() * 1e6)) });
  const headers = process.env.POLLINATIONS_API_KEY ? { authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` } : {};
  const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(cut(body.prompt, 1500))}?${q}`, { headers });
  if (!r.ok) throw new Error(r.status === 429 ? "The free image service is busy — wait about 15 seconds and try again." : `Pollinations error ${r.status}`);
  const type = r.headers.get("content-type") || "image/jpeg";
  if (!type.startsWith("image/")) throw new Error("The free image service didn't return an image.");
  return { b64: Buffer.from(await r.arrayBuffer()).toString("base64"), mime: type.split(";")[0] };
}

async function image(body) {
  if (imageProvider() === "pollinations") return pollinations(body);
  const size = body.aspect === "9:16" ? "1024x1536" : body.aspect === "1:1" ? "1024x1024" : "1536x1024";
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt: cut(body.prompt, 3800), size, n: 1 }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `OpenAI API error ${r.status}`);
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image was returned.");
  return { b64, mime: "image/png" };
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  const tp = textProvider(), ip = imageProvider();
  if (req.method === "GET") return res.status(200).json({ text: !!tp, image: !!ip, provider: tp ? LABEL[tp] : "", imageProvider: ip ? LABEL[ip] : "" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  try {
    if (body.task === "json") return res.status(200).json(await llm(cut(body.system, 12000), cut(body.user, 20000), Math.min(8000, Number(body.maxTokens) || 4000)));
    if (body.task === "storyboard") return res.status(200).json(await storyboard(body));
    if (body.task === "assist") return res.status(200).json(await assist(body));
    if (body.task === "image") { if (!ip) throw new Error("Image generation is turned off on the server."); return res.status(200).json(await image(body)); }
    return res.status(400).json({ error: "Unknown task" });
  } catch (e) {
    return res.status(502).json({ error: String(e?.message || e) });
  }
}
