// SceneCraft — optional AI server function (Vercel / Node 18+).
// Keys live in environment variables on the server and never reach the browser.
//
// TEXT (storyboard proposals + Prompt Assistant) — the first one that is set is used:
//   GEMINI_API_KEY      free tier from Google AI Studio      (GEMINI_MODEL, default gemini-flash-latest)
//   GROQ_API_KEY        free tier from console.groq.com      (GROQ_MODEL, default openai/gpt-oss-120b)
//   ANTHROPIC_API_KEY   paid                                  (ANTHROPIC_MODEL, default claude-sonnet-5-5)
//   TEXT_PROVIDER       optional: "gemini" | "groq" | "anthropic" to force one
//
// IMAGES (storyboard image generation) — the first one that is set is used:
//   OPENAI_API_KEY      paid, separate from a ChatGPT subscription (OPENAI_IMAGE_MODEL, default gpt-image-2.5-flare)
//   CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN
//                       FREE: Cloudflare Workers AI, FLUX.2 [klein] — 10,000 free "neurons" a day (~90 photoreal frames)
//                       (CLOUDFLARE_IMAGE_MODEL, default @cf/black-forest-labs/flux-2-klein-4b; also works with
//                        flux-2-klein-9b / flux-2-dev (sharper, far fewer free frames), flux-1-schnell, @cf/leonardo/lucid-origin)
//   POLLINATIONS_API_KEY Pollinations (gen.pollinations.ai) — now needs a key with Pollen credit on it.
//   IMAGE_PROVIDER      optional: "openai" | "cloudflare" | "pollinations" to force one
// With none of these set, SceneCraft does not make frames itself: use "Copy image prompts" and upload the results.

const TEXT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
// tried in order if a model is retired or not enabled on the key (Groq retires models regularly)
const GROQ_FALLBACKS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];

function textProvider() {
  const forced = (process.env.TEXT_PROVIDER || "").toLowerCase();
  const has = { gemini: !!process.env.GEMINI_API_KEY, groq: !!process.env.GROQ_API_KEY, anthropic: !!process.env.ANTHROPIC_API_KEY };
  if (forced && has[forced]) return forced;
  return has.gemini ? "gemini" : has.groq ? "groq" : has.anthropic ? "anthropic" : null;
}
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || "";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || "";
const CF_MODEL = process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-2-klein-4b";
function imageProvider() {
  const has = { openai: !!process.env.OPENAI_API_KEY, cloudflare: !!(CF_ACCOUNT && CF_TOKEN), pollinations: !!process.env.POLLINATIONS_API_KEY && (process.env.POLLINATIONS || "").toLowerCase() !== "off" };
  const forced = (process.env.IMAGE_PROVIDER || "").toLowerCase();
  if (forced && has[forced]) return forced;
  return has.openai ? "openai" : has.cloudflare ? "cloudflare" : has.pollinations ? "pollinations" : null;
}
const LABEL = { gemini: "Gemini (free tier)", groq: "Groq (free tier)", anthropic: "Claude", openai: "OpenAI", cloudflare: /flux-2/.test(CF_MODEL) ? "Cloudflare FLUX.2 (free)" : "Cloudflare (free)", pollinations: "Pollinations" };

function parseJSON(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("The model didn't return JSON.");
  return JSON.parse(text.slice(a, b + 1));
}

async function gemini(system, user, maxTokens, model = GEMINI_MODEL, signal) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", signal,
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens, temperature: 0.7 },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || `Gemini API error ${r.status}`), { status: r.status });
  return parseJSON((j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join(""));
}

async function groqOnce(model, system, user, maxTokens, signal) {
  const reasoning = /gpt-oss|qwen3/.test(model);
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model, temperature: 0.7, response_format: { type: "json_object" },
      // reasoning models spend tokens thinking first: keep it light and leave room for the answer
      ...(reasoning ? { max_completion_tokens: maxTokens + 3000, ...(/gpt-oss/.test(model) ? { reasoning_effort: "low" } : { reasoning_format: "hidden" }) } : { max_tokens: maxTokens }),
      messages: [{ role: "system", content: system + "\nRespond with a single JSON object." }, { role: "user", content: user }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || `Groq API error ${r.status}`), { status: r.status, gone: r.status === 404 || /does not exist|decommission|not have access|deprecated|not found/i.test(j?.error?.message || "") });
  return parseJSON(j.choices?.[0]?.message?.content || "");
}
async function groq(system, user, maxTokens, signal) {
  const models = [GROQ_MODEL, ...GROQ_FALLBACKS.filter((m) => m !== GROQ_MODEL)];
  let last;
  for (const m of models) {
    try { return await groqOnce(m, system, user, maxTokens, signal); }
    catch (e) { last = e; if (!e.gone) throw e; }
  }
  throw last;
}

/** every text provider that has a key, the preferred one first */
function textProviders() {
  const first = textProvider();
  if (!first) return [];
  const all = ["gemini", "groq", "anthropic"].filter((k) => !!process.env[{ gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY", anthropic: "ANTHROPIC_API_KEY" }[k]]);
  return [first, ...all.filter((k) => k !== first)];
}
/** "busy", "high demand", rate limits and server errors are worth trying elsewhere */
const transient = (e) => (e?.status && (e.status === 429 || e.status >= 500)) || /high demand|overload|unavailable|try again|rate limit|quota|exhausted|timeout|busy|capacity/i.test(String(e?.message || e));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function llm(system, user, maxTokens) {
  const list = textProviders();
  if (!list.length) throw new Error("No text AI key is set on the server (GEMINI_API_KEY, GROQ_API_KEY or ANTHROPIC_API_KEY).");
  const errors = [];
  // stay inside the function's time limit (vercel.json maxDuration 300 s): no single AI may hang the whole request
  const deadline = Date.now() + 270000;
  const sig = (cap) => AbortSignal.timeout(Math.max(5000, Math.min(cap, deadline - Date.now())));
  for (const p of list) {
    const attempts = p === "gemini"
      ? [() => gemini(system, user, maxTokens, GEMINI_MODEL, sig(100000)), () => gemini(system, user, maxTokens, process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest", sig(80000))]
      : [() => (p === "groq" ? groq : claude)(system, user, maxTokens, sig(120000))];
    for (let i = 0; i < attempts.length; i++) {
      try { return await attempts[i](); }
      catch (e0) {
        const e = e0?.name === "TimeoutError" || e0?.name === "AbortError" ? Object.assign(new Error("took too long to answer (timeout)"), { status: 504 }) : e0;
        errors.push(`${LABEL[p]}: ${e?.message || e}`);
        if (Date.now() > deadline - 5000) break;
        if (!transient(e)) { if (list.length === 1) throw e; break; }
        if (list.length === 1 && i === attempts.length - 1) { await wait(2500); try { return await attempts[0](); } catch (e2) { throw e2; } }
      }
    }
  }
  throw new Error(errors.length > 1 ? `All AI services were busy — ${errors.join(" · ")}` : errors[0]);
}

const FRAMINGS = ["Extreme Wide Shot", "Wide Shot", "Medium Shot", "Close-Up", "Extreme Close-Up", "Over-the-Shoulder", "POV"];
const MOVES = ["Static", "Dolly In", "Dolly Out", "Pan Left", "Pan Right", "Tilt Up", "Tilt Down", "Tracking Shot", "Orbit", "Crane", "Handheld"];
const LIGHTS = ["Natural Daylight", "Golden Hour", "Sunset", "Moonlight", "Soft Studio Lighting", "Dramatic Low-Key", "Neon Night", "Pre-Dawn"];
const MOODS = ["Peaceful", "Dramatic", "Mysterious", "Romantic", "Intense", "Melancholic", "Hopeful", "Tense"];
const TIMES = ["Dawn", "Morning", "Midday", "Afternoon", "Golden Hour", "Dusk", "Night", "Midnight"];

const cut = (s, n) => String(s ?? "").slice(0, n);

async function claude(system, user, maxTokens = 4000, signal) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal,
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: TEXT_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || `Anthropic API error ${r.status}`), { status: r.status });
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

const SIZES = (aspect) => aspect === "9:16" ? [768, 1344] : aspect === "1:1" ? [1024, 1024] : aspect === "2.39:1" ? [1536, 640] : [1344, 768];

/** long side 1024 (keeps the free allowance at ~90 frames a day), short side to the film's aspect, multiples of 16 */
function cfSize(aspect) {
  const [a, b] = String(aspect || "16:9").split(":").map(Number);
  const r = a && b ? a / b : 16 / 9, r16 = (n) => Math.max(256, Math.round(n / 16) * 16);
  return r >= 1 ? [1024, r16(1024 / r)] : [r16(1024 * r), 1024];
}
async function cloudflare(body) {
  const [width, height] = cfSize(body.aspect);
  const seed = Math.floor(Math.random() * 1e6);
  const prompt = cut(body.prompt, 2000);
  let init;
  if (/flux-2/.test(CF_MODEL)) {
    // FLUX.2 takes multipart form data; character photos go in as reference images (input_image_0..3)
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", String(width)); form.append("height", String(height)); form.append("seed", String(seed));
    (Array.isArray(body.refs) ? body.refs : []).slice(0, 4).forEach((r, i) => {
      if (r && typeof r.b64 === "string" && r.b64.length < 600000) form.append(`input_image_${i}`, new Blob([Buffer.from(r.b64, "base64")], { type: r.mime || "image/jpeg" }), `ref${i}.jpg`);
    });
    init = { body: form };
  } else if (/flux-1/.test(CF_MODEL)) {
    init = { headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, steps: 8, seed }) };
  } else {
    init = { headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, width, height, num_steps: 25, seed }) };
  }
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(CF_ACCOUNT)}/ai/run/${CF_MODEL}`, {
    method: "POST", ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${CF_TOKEN}` },
  });
  const type = r.headers.get("content-type") || "";
  if (r.ok && type.startsWith("image/")) return { b64: Buffer.from(await r.arrayBuffer()).toString("base64"), mime: type.split(";")[0] };
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) {
    const msg = j?.errors?.[0]?.message || `Cloudflare error ${r.status}`;
    if (r.status === 429 || /neuron|daily|limit|quota/i.test(msg)) throw new Error("Today's free Cloudflare image allowance is used up — it resets at 05:30 India time (00:00 UTC).");
    if (r.status === 401 || r.status === 403) throw new Error("Cloudflare rejected the key — check CLOUDFLARE_ACCOUNT_ID and that CLOUDFLARE_API_TOKEN has Workers AI permission.");
    throw new Error(`Cloudflare: ${msg}`);
  }
  const b64 = j?.result?.image ?? j?.image;
  if (!b64) throw new Error("Cloudflare didn't return an image.");
  return { b64, mime: b64.startsWith("iVBOR") ? "image/png" : "image/jpeg" };
}

async function pollinations(body) {
  const [w, h] = SIZES(body.aspect);
  const q = new URLSearchParams({ width: String(w), height: String(h), model: "flux", nologo: "true", seed: String(Math.floor(Math.random() * 1e6)) });
  const r = await fetch(`https://gen.pollinations.ai/image/${encodeURIComponent(cut(body.prompt, 1500))}?${q}`, { headers: { authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` } });
  if (!r.ok) {
    if (r.status === 402) throw new Error("Pollinations has no credit left on this key (error 402) — it's no longer free. Add the free Cloudflare keys instead.");
    if (r.status === 401 || r.status === 403) throw new Error("Pollinations rejected the key (use a secret sk_ key from enter.pollinations.ai).");
    throw new Error(r.status === 429 ? "The image service is busy — wait about 15 seconds and try again." : `Pollinations error ${r.status}`);
  }
  const type = r.headers.get("content-type") || "image/jpeg";
  if (!type.startsWith("image/")) throw new Error("Pollinations didn't return an image.");
  return { b64: Buffer.from(await r.arrayBuffer()).toString("base64"), mime: type.split(";")[0] };
}

async function image(body) {
  const ip = imageProvider();
  if (ip === "cloudflare") return cloudflare(body);
  if (ip === "pollinations") return pollinations(body);
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
