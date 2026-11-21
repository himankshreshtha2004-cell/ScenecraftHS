// SceneCraft — optional AI server function (Vercel / Node 18+).
// Keys live in environment variables on the server and never reach the browser:
//   ANTHROPIC_API_KEY   enables "Create My Storyboard" proposals and the Prompt Assistant
//   ANTHROPIC_MODEL     optional, defaults to claude-sonnet-5-5
//   OPENAI_API_KEY      enables storyboard image generation
//   OPENAI_IMAGE_MODEL  optional, defaults to gpt-image-1

const TEXT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

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
  const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("The model didn't return JSON.");
  return JSON.parse(text.slice(a, b + 1));
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
  return claude(system, user, 6000);
}

async function assist(body) {
  const system = `You revise video-generation prompts for a film pre-production tool. Reply with JSON only:
{"prompt": string, "summary": string, "changes": {"framing"?: string, "movement"?: string, "lighting"?: string, "mood"?: string, "timeOfDay"?: string, "motion"?: string}}
"prompt" is the full revised prompt. "summary" is one sentence saying what you changed. Only include a key in "changes" when the request changes that setting; values must come from these lists —
framing: ${FRAMINGS.join(", ")}; movement: ${MOVES.join(", ")}; lighting: ${LIGHTS.join(", ")}; mood: ${MOODS.join(", ")}; timeOfDay: ${TIMES.join(", ")}; motion is free text.
Never remove or alter these locked details: ${(body.locked || []).map((x) => cut(x, 80)).join("; ") || "none"}. Keep every character's appearance and wardrobe text exactly as written.`;
  const user = `Current prompt:\n${cut(body.prompt, 6000)}\n\nShot settings: ${cut(JSON.stringify(body.shot || {}), 2000)}\n\nRequested change: ${cut(body.request, 600)}`;
  return claude(system, user, 2500);
}

async function image(body) {
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
  const text = !!process.env.ANTHROPIC_API_KEY, img = !!process.env.OPENAI_API_KEY;
  if (req.method === "GET") return res.status(200).json({ text, image: img, provider: text ? "Claude" : "", imageProvider: img ? "OpenAI" : "" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  try {
    if (body.task === "storyboard") { if (!text) throw new Error("ANTHROPIC_API_KEY is not set on the server."); return res.status(200).json(await storyboard(body)); }
    if (body.task === "assist") { if (!text) throw new Error("ANTHROPIC_API_KEY is not set on the server."); return res.status(200).json(await assist(body)); }
    if (body.task === "image") { if (!img) throw new Error("OPENAI_API_KEY is not set on the server."); return res.status(200).json(await image(body)); }
    return res.status(400).json({ error: "Unknown task" });
  } catch (e) {
    return res.status(502).json({ error: String(e?.message || e) });
  }
}
