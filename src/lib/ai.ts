// Optional AI features. Two ways to reach a model — whichever is available:
//  1. Inside Claude (the published claude.ai page): the page's `sample` capability asks Claude directly.
//  2. Deployed on Vercel: the server function at /api/ai, with free (Gemini, Groq) or paid keys set on the server.
// Keys never reach the browser.
import { FRAMINGS, LIGHTINGS, MOODS, MOVEMENTS, TIMES } from "./options";

export interface AIStatus { checked: boolean; text: boolean; image: boolean; provider: string; imageProvider: string; via?: "claude" | "server" }

const base = () => {
  try { return (localStorage.getItem("scenecraft.aiEndpoint") || "").trim() || "./api/ai"; } catch { return "./api/ai"; }
};

let sampler: any = null;
async function claudeSample(): Promise<any> {
  const w = window as any;
  if (!w.claude?.use) return null;
  if (sampler) return sampler;
  try {
    sampler = await Promise.race([w.claude.use("sample"), new Promise((r) => setTimeout(() => r(null), 9000))]);
  } catch { sampler = null; }
  return sampler;
}

export async function checkAI(): Promise<AIStatus> {
  let server = { text: false, image: false, provider: "", imageProvider: "" };
  try {
    const r = await fetch(base() + "?status=1", { headers: { accept: "application/json" } });
    if (r.ok && (r.headers.get("content-type") || "").includes("json")) { const j = await r.json(); server = { text: !!j.text, image: !!j.image, provider: j.provider || "", imageProvider: j.imageProvider || "" }; }
  } catch { /* static hosting: no server function */ }
  if (server.text) return { checked: true, ...server, via: "server" };
  const s = await claudeSample();
  if (s) return { checked: true, text: true, image: server.image, provider: "Claude", imageProvider: server.imageProvider, via: "claude" };
  return { checked: true, ...server };
}

function parseJSON(text: string) {
  const t = text.replace(/```(?:json)?/g, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("The AI didn't return a usable answer. Try again.");
  return JSON.parse(t.slice(a, b + 1));
}

/** asks the connected model for JSON: system rules + user data in, parsed object out */
export async function askJSON<T>(system: string, user: string, opts: { tier?: "quick" | "default" | "complex"; maxTokens?: number; onProgress?: (chars: number) => void } = {}): Promise<T> {
  const s = await claudeSample();
  let serverOk = false;
  try { const st = await checkServerText(); serverOk = st; } catch { /* */ }
  if (!serverOk && s) {
    try {
      const r = await s(`${system}\n\n---\n\n${user}\n\nReply with the JSON object only.`, { modelTier: opts.tier ?? "default", onText: (e: any) => opts.onProgress?.(e?.text?.length ?? 0) });
      return parseJSON(r.text) as T;
    } catch (e: any) {
      if (e?.code === "not_granted") throw new Error("Claude access wasn't allowed for this page.");
      if (e?.code === "rate_limited") throw new Error("Claude is busy right now — wait a moment and try again.");
      throw new Error(e?.message || "The AI request failed.");
    }
  }
  const r = await fetch(base(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "json", system, user, maxTokens: opts.maxTokens ?? 6000 }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `The AI service answered ${r.status}.`);
  return j as T;
}
let serverText: boolean | null = null;
async function checkServerText() {
  if (serverText != null) return serverText;
  try { const r = await fetch(base() + "?status=1"); serverText = r.ok && (r.headers.get("content-type") || "").includes("json") ? !!(await r.json()).text : false; } catch { serverText = false; }
  return serverText;
}

/* ------------------------------------------------------------------ prompts for each task */
const LISTS = `framing: ${FRAMINGS.map((x) => x.value).join(", ")}
movement: ${MOVEMENTS.map((x) => x.value).join(", ")}
lighting: ${LIGHTINGS.map((x) => x.value).join(", ")}
mood: ${MOODS.map((x) => x.value).join(", ")}
timeOfDay: ${TIMES.join(", ")}`;

const SHOT_SCHEMA = `{"title":string,"description":string,"duration":number,"framing":string,"movement":string,"lighting":string,"mood":string,"timeOfDay":string,"motion":string,"characters":[string],"location":string,"dialogue":[{"speaker":string,"line":string,"delivery":string}],"sound":string}`;

const SHOT_RULES = `Shot rules:
- Each shot is ONE clip an AI video generator will animate on its own (Higgsfield, Sora, Veo, Kling). Durations are whole seconds from 3 to 10.
- "description" is 1–2 sentences of what the camera SEES: subject, action, setting. No camera jargon there.
- "motion" says what moves during the clip (people, objects, weather, light).
- "dialogue" holds the spoken lines in this clip only: short, natural lines a character can say within the duration (about 2.5 words per second at most). Use "delivery" for how it's said, e.g. "whispering", "angry", "over the phone", "V.O." for voice-over. Speakers must be character names from the list, or "Narrator". Many shots have no dialogue — that's fine.
- "sound" lists ambience, effects or music for the clip.
- "characters" and "location" must use names exactly as defined.
Allowed values:
${LISTS}`;

export interface ProposedShot {
  title: string; description: string; duration: number; framing: string; movement: string; lighting: string; mood: string; timeOfDay: string; motion: string;
  characters?: string[]; location?: string; dialogue?: { speaker: string; line: string; delivery?: string }[]; sound?: string;
}
export interface ProposedBoard {
  title: string; logline: string;
  style?: { visualStyle?: string; palette?: string; cameraLanguage?: string; lighting?: string; atmosphere?: string };
  characters: { name: string; role?: string; description: string; face?: string; hair?: string; clothes?: string; accessories?: string }[];
  locations: { name: string; description: string; architecture?: string; objects?: string; lighting?: string }[];
  scenes: { title: string; summary: string; shots: ProposedShot[] }[];
}

export function writeFilm(input: { concept: string; genre: string; filmStyle: string; duration: number; complexity: string; aspect: string; title?: string; shots?: number }, onProgress?: (n: number) => void) {
  const per = input.complexity === "simple" ? 8 : input.complexity === "balanced" ? 6 : 4;
  const count = input.shots || Math.max(3, Math.min(24, Math.round(input.duration / per)));
  const countRule = input.shots ? `EXACTLY ${count} shots in total — no more, no fewer — across 1–4 scenes` : `about ${count} shots in total across 1–4 scenes`;
  const system = `You are a screenwriter and director planning a short film that will be made shot by shot with AI video generators.
Write the whole film: a title, a logline, a consistent visual style, characters with precise, unchanging looks (face, hair, one main outfit), locations with clear architecture, and scenes broken into shots with dialogue.
Return JSON only, matching:
{"title":string,"logline":string,"style":{"visualStyle":string,"palette":string,"cameraLanguage":string,"lighting":string,"atmosphere":string},
"characters":[{"name":string,"role":string,"description":string,"face":string,"hair":string,"clothes":string,"accessories":string}],
"locations":[{"name":string,"description":string,"architecture":string,"objects":string,"lighting":string}],
"scenes":[{"title":string,"summary":string,"shots":[${SHOT_SCHEMA}]}]}
Story rules: a clear beginning, middle and end; ${countRule}; shot durations add up to roughly ${input.duration} seconds; vary framing (wide, medium, close) like a real edit; keep character descriptions visual and specific so every clip looks like the same person.
${SHOT_RULES}`;
  const user = `Film idea: ${input.concept}\nGenre: ${input.genre}\nLook: ${input.filmStyle}\nAspect ratio: ${input.aspect}${input.title ? `\nTitle: ${input.title}` : ""}`;
  return askJSON<ProposedBoard>(system, user, { tier: "complex", maxTokens: 8000, onProgress });
}

export function continueStory(ctx: string, n: number) {
  const system = `You are continuing a short film planned for AI video generation. Write the NEXT scene only — it must follow on naturally from the story so far and reuse the existing characters and locations by name.
Return JSON only: {"title":string,"summary":string,"shots":[${SHOT_SCHEMA}]} with ${n} shots.
${SHOT_RULES}`;
  return askJSON<{ title: string; summary: string; shots: ProposedShot[] }>(system, ctx, { tier: "default" });
}

export function writeDialogue(ctx: string) {
  const system = `You write dialogue for ONE shot of a short film made with AI video generators. Keep lines short enough to be spoken within the shot's duration (about 2.5 words per second), natural and in character. Use "delivery" for how a line is said ("whispering", "over the phone", "V.O." for voice-over). Speakers must be names from the cast list or "Narrator". If the shot works better silent, return an empty list and suggest sound instead.
Return JSON only: {"dialogue":[{"speaker":string,"line":string,"delivery":string}],"sound":string}`;
  return askJSON<{ dialogue: { speaker: string; line: string; delivery?: string }[]; sound?: string }>(system, ctx, { tier: "quick" });
}

export interface PromptSuggestion { prompt: string; summary: string; changes: Partial<Record<"framing" | "movement" | "lighting" | "mood" | "timeOfDay" | "motion", string>> }
export const assistPrompt = (input: { request: string; prompt: string; shot: Record<string, unknown>; locked: string[] }) =>
  askJSON<PromptSuggestion>(`You revise video-generation prompts for a film pre-production tool. Return JSON only:
{"prompt": string, "summary": string, "changes": {"framing"?: string, "movement"?: string, "lighting"?: string, "mood"?: string, "timeOfDay"?: string, "motion"?: string}}
"prompt" is the full revised prompt; "summary" is one sentence on what changed. Only include a key in "changes" when the request changes that setting. Values must come from:
${LISTS}
Never remove or alter these locked details: ${input.locked.join("; ") || "none"}. Keep every character's appearance, wardrobe text and any dialogue lines exactly as written unless the request asks to change the dialogue.`,
    `Current prompt:\n${input.prompt}\n\nShot settings: ${JSON.stringify(input.shot)}\n\nRequested change: ${input.request}`, { tier: "default" });

export async function generateImage(input: { prompt: string; aspect: string }) {
  const r = await fetch(base(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "image", ...input }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `The image service answered ${r.status}.`);
  return j as { b64: string; mime: string };
}

/* ------------------------------------------------------------------ storyboard sketches drawn by the model as SVG */
export async function drawSketch(input: { prompt: string; aspect: string; title: string }) {
  const [w, h] = input.aspect.split(":").map(Number);
  const W = 1600, H = Math.round((1600 * h) / w);
  const system = `You are a storyboard artist. Draw ONE cinematic storyboard frame as a single, self-contained SVG.
Rules:
- Root element: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">. Fill the whole canvas with a background first.
- Draw the scene as described: the camera framing (wide / medium / close-up), the subject's pose and position, the setting, the time of day and the lighting mood. Compose it like a film still: rule of thirds, depth (foreground, midground, background), strong silhouettes.
- Style: painterly storyboard illustration — flat shapes with gradients (linearGradient / radialGradient), soft glows (feGaussianBlur), simple human figures as clean silhouettes with readable poses. Use the colour palette the description implies.
- No text, no letters, no captions, no watermarks. No <script>, no <foreignObject>, no external images or links, no animation.
- Keep it under about 14 KB.
Return JSON only: {"svg": "<svg ...>...</svg>"}`;
  const r = await askJSON<{ svg: string }>(system, `Shot: ${input.title}\n${input.prompt}`, { tier: "default", maxTokens: 7000 });
  if (!r?.svg || !/<svg[\s>]/i.test(r.svg)) throw new Error("No drawing came back.");
  return r.svg;
}
