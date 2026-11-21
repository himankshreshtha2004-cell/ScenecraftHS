import { FRAMINGS, LIGHTINGS, MOVEMENTS, phrase } from "./options";
import type { Character, Location, Project, Shot, StyleProfile } from "./types";

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const clean = (s: string) => s.trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
const sentence = (s: string) => (s.trim() ? cap(clean(s)) + "." : "");
const join = (parts: (string | false | null | undefined)[]) => (parts.filter((p) => p && p.trim()) as string[]).join(" ").replace(/\s+/g, " ").trim();
const list = (xs: string[]) => {
  const a = xs.filter(Boolean);
  return a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
};

export function effectiveStyle(p: Project, s: Shot): StyleProfile & { overridden: string[] } {
  const st = { ...p.style, overridden: [] as string[] };
  if (!p.style.locked) return st;
  (["visualStyle", "palette", "lighting"] as const).forEach((k) => {
    const v = s.styleOverride?.[k];
    if (v && v.trim()) { (st as any)[k] = v; st.overridden.push(k); }
  });
  return st;
}

export function shotCharacters(p: Project, s: Shot) {
  return s.characters
    .map((sc) => {
      const c = p.characters.find((x) => x.id === sc.characterId);
      if (!c) return null;
      const w = c.wardrobes.find((x) => x.id === sc.wardrobeId) ?? c.wardrobes.find((x) => x.id === c.lockedWardrobeId) ?? c.wardrobes[0];
      return { c, w };
    })
    .filter(Boolean) as { c: Character; w: Character["wardrobes"][number] | undefined }[];
}

export function shotLocation(p: Project, s: Shot) {
  const l = p.locations.find((x) => x.id === s.locationId) ?? null;
  const v = l?.variants.find((x) => x.id === s.locationVariantId) ?? null;
  return { l, v };
}

function characterSentence(c: Character, wardrobe?: { clothes: string }) {
  if (!c.locked) return sentence(`${c.name}${c.description ? `, ${c.description.replace(/\.$/, "")}` : ""}`);
  const bits = [
    c.description,
    c.face && `${c.face}`,
    c.hair && `${c.hair}`,
    wardrobe?.clothes && `wearing ${wardrobe.clothes}`,
    c.accessories && `with ${c.accessories}`,
  ].filter(Boolean) as string[];
  return sentence(`${c.name}: ${bits.map(clean).join("; ")}`);
}

function locationSentence(l: Location, v: Location["variants"][number] | null, archOverride: string, materials = true) {
  const arch = archOverride.trim() || l.architecture;
  if (!l.locked) return sentence(`Set in ${l.name}${l.description ? ` — ${clean(l.description)}` : ""}`);
  return join([
    sentence(`Set in ${l.name}: ${clean(l.description)}`),
    arch && sentence(`Architecture: ${arch}`),
    l.objects && sentence(`Key background details: ${l.objects}`),
    materials && l.materials && sentence(`Materials: ${l.materials}`),
    v && sentence(`Conditions: ${[v.weather, v.lighting].filter(Boolean).map(clean).join(", ")}`),
  ]);
}

function styleSentence(st: StyleProfile, filmStyle: string, forImage = false) {
  if (!st.locked) return forImage ? sentence(`${filmStyle} look`) : "";
  const grain = st.grain === "none" ? "clean digital image without grain" : `${st.grain} film grain`;
  return join([
    sentence(`Visual style: ${st.visualStyle}`),
    st.palette && sentence(`Colour palette: ${st.palette}`),
    st.cameraLanguage && sentence(`Camera language: ${st.cameraLanguage}`),
    sentence(`${cap(st.contrast)} contrast, ${grain}`),
    st.atmosphere && sentence(`Atmosphere: ${st.atmosphere}`),
  ]);
}

function continuity(p: Project, s: Shot) {
  const keep: string[] = [];
  shotCharacters(p, s).forEach(({ c }) => c.locked && keep.push(`${c.name}'s face, hair and wardrobe`));
  const { l } = shotLocation(p, s);
  if (l?.locked) keep.push(`the architecture and layout of ${l.name}`);
  if (p.style.locked) keep.push("the established colour grading");
  return keep.length ? sentence(`Keep ${list(keep)} consistent with the references`) : "";
}

const FRAMING_WORDS = /^(extreme |wide|medium|close|over-the-shoulder|pov|point-of-view|establishing|aerial|low-angle|high-angle)/i;
function opening(p: Project, s: Shot) {
  const look = p.style.locked ? "Cinematic" : cap(p.filmStyle.toLowerCase());
  const d = clean(s.description);
  if (!d) return sentence(`${look} ${phrase(FRAMINGS, s.framing)} — ${s.title.toLowerCase()}`);
  if (FRAMING_WORDS.test(d)) return sentence(`${look} ${d[0].toLowerCase()}${d.slice(1)}`);
  return join([sentence(`${look} ${phrase(FRAMINGS, s.framing)}`), sentence(d)]);
}

export function speakerName(p: Project, id: string) {
  return p.characters.find((c) => c.id === id)?.name ?? id;
}
const isVO = (d: string) => /\b(v\.?o\.?|voice-?over)\b/i.test(d);
export function dialogueLines(p: Project, s: Shot) {
  return s.dialogue.filter((d) => d.line.trim()).map((d) => {
    const who = speakerName(p, d.speaker) || "Someone";
    const how = d.delivery.trim();
    return { who, how, line: d.line.trim().replace(/^["“]|["”]$/g, ""), vo: isVO(how) };
  });
}
function dialogueSentence(p: Project, s: Shot) {
  const ls = dialogueLines(p, s);
  if (!ls.length) return "";
  return "Dialogue: " + ls.map((d) => `${d.who}${d.how ? ` (${d.how})` : ""}: "${d.line}"`).join(" ") + (ls.some((d) => !d.vo) ? " Lip movements match the spoken lines." : "");
}

/** The structured video-generation prompt, assembled from the shot's production data. */
export function buildVideoPrompt(p: Project, s: Shot): string {
  const st = effectiveStyle(p, s);
  const chars = shotCharacters(p, s);
  const { l, v } = shotLocation(p, s);
  const lightingPhrase = st.locked && s.styleOverride?.lighting ? s.styleOverride.lighting : phrase(LIGHTINGS, s.lighting);
  return join([
    opening(p, s),
    ...chars.map(({ c, w }) => characterSentence(c, w)),
    l ? locationSentence(l, v, s.architectureOverride, false) : "",
    sentence(`${cap(s.timeOfDay.toLowerCase())}, ${lightingPhrase}${st.locked && st.lighting && !s.styleOverride?.lighting ? `, ${clean(st.lighting)}` : ""}`),
    phrase(MOVEMENTS, s.movement),
    s.motion.trim() && sentence(`Motion: ${s.motion}`),
    s.mood && sentence(`${s.mood} mood`),
    dialogueSentence(p, s),
    s.sound.trim() && sentence(`Sound: ${s.sound}`),
    styleSentence(st, p.filmStyle),
    continuity(p, s),
    sentence(`Duration about ${s.duration} seconds, ${p.aspect} aspect ratio`),
  ]);
}

/** A still-frame prompt for making the storyboard image (no camera motion, no duration). */
export function buildImagePrompt(p: Project, s: Shot): string {
  const st = effectiveStyle(p, s);
  const chars = shotCharacters(p, s);
  const { l, v } = shotLocation(p, s);
  return join([
    sentence(`Cinematic film still, ${p.aspect}, ${phrase(FRAMINGS, s.framing)}: ${clean(s.description || s.title)}`),
    ...chars.map(({ c, w }) => characterSentence(c, w)),
    l ? locationSentence(l, v, s.architectureOverride) : "",
    sentence(`${cap(s.timeOfDay.toLowerCase())}, ${phrase(LIGHTINGS, s.lighting)}, ${s.mood.toLowerCase()} mood`),
    styleSentence(st, p.filmStyle, true),
  ]);
}

export const promptOf = (p: Project, s: Shot) => s.promptText ?? buildVideoPrompt(p, s);
export const tokenEstimate = (t: string) => Math.ceil(t.split(/\s+/).filter(Boolean).length * 1.33);

/** a tiny word diff for "Compare versions" — marks words added/removed */
export function diffWords(a: string, b: string): { t: string; k: "same" | "add" | "del" }[] {
  const A = a.split(/(\s+)/), B = b.split(/(\s+)/);
  const n = A.length, m = B.length;
  if (n * m > 400000) return [{ t: a, k: "del" }, { t: b, k: "add" }];
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { t: string; k: "same" | "add" | "del" }[] = [];
  let i = 0, j = 0;
  const push = (t: string, k: "same" | "add" | "del") => { const last = out[out.length - 1]; if (last && last.k === k) last.t += t; else out.push({ t, k }); };
  while (i < n && j < m) {
    if (A[i] === B[j]) { push(A[i], "same"); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) push(A[i++], "del");
    else push(B[j++], "add");
  }
  while (i < n) push(A[i++], "del");
  while (j < m) push(B[j++], "add");
  return out;
}

/* ------------------------------------------------------------------ per-tool prompt formats */
export const TARGETS: { value: "higgsfield" | "sora" | "generic"; label: string; hint: string; url: string }[] = [
  { value: "higgsfield", label: "Higgsfield", hint: "One compact paragraph — paste into the video prompt box with your start frame.", url: "https://higgsfield.ai" },
  { value: "sora", label: "OpenAI Sora", hint: "Structured lines with separate camera, action and dialogue — Sora follows these closely.", url: "https://sora.chatgpt.com" },
  { value: "generic", label: "Full prompt", hint: "The complete SceneCraft prompt (including your hand edits) for any other tool.", url: "" },
];

function charShort(c: Character, w?: { clothes: string }) {
  return [c.name + (c.description ? `, ${clean(c.description)}` : ""), c.hair && clean(c.hair), w?.clothes && `wearing ${clean(w.clothes)}`].filter(Boolean).join(", ");
}

export function formatPrompt(p: Project, s: Shot, target: "higgsfield" | "sora" | "generic"): string {
  if (target === "generic") return promptOf(p, s);
  const st = effectiveStyle(p, s);
  const chars = shotCharacters(p, s);
  const { l, v } = shotLocation(p, s);
  const look = p.style.locked ? `${clean(st.visualStyle)}` : p.filmStyle.toLowerCase();
  const light = `${s.timeOfDay.toLowerCase()}, ${phrase(LIGHTINGS, s.lighting)}`;
  const dl = dialogueLines(p, s);
  if (target === "higgsfield") {
    return join([
      opening(p, s),
      ...chars.map(({ c, w }) => sentence(charShort(c, w))),
      l && sentence(`Setting: ${l.name}, ${clean(l.description)}${v ? `, ${[v.weather, v.lighting].filter(Boolean).map(clean).join(", ")}` : ""}`),
      sentence(cap(light)),
      phrase(MOVEMENTS, s.movement),
      s.motion.trim() && sentence(s.motion),
      ...dl.map((d) => `${d.who}${d.vo ? " (voice-over)" : d.how ? ` (${clean(d.how)})` : ""} says: "${d.line}"`),
      s.sound.trim() && sentence(`Sound: ${s.sound}`),
      sentence(`${cap(look)}${p.style.locked && st.palette ? `, ${clean(st.palette)}` : ""}, ${s.mood.toLowerCase()} mood`),
    ]);
  }
  // Sora: labelled sections
  const L: string[] = [];
  L.push(`${cap(look)} ${phrase(FRAMINGS, s.framing)}. ${s.description.trim() ? sentence(s.description) : s.title}`);
  if (chars.length) L.push("", "Characters:", ...chars.map(({ c, w }) => `- ${charShort(c, w)}${c.locked && c.face ? `; ${clean(c.face)}` : ""}`));
  if (l) L.push("", `Setting: ${l.name} — ${clean(l.description)}${l.locked && l.architecture ? `; ${clean(s.architectureOverride || l.architecture)}` : ""}.${v ? ` ${cap([v.weather, v.lighting].filter(Boolean).map(clean).join(", "))}.` : ""}`);
  L.push(`Time and light: ${cap(light)}.`);
  L.push("", `Camera: ${s.framing}. ${phrase(MOVEMENTS, s.movement)}`);
  if (s.motion.trim()) L.push(`Action: ${sentence(s.motion)}`);
  if (dl.length) L.push("", "Dialogue:", ...dl.map((d) => `${d.who}${d.vo ? " (V.O.)" : d.how ? ` (${clean(d.how)})` : ""}: "${d.line}"`));
  if (s.sound.trim()) L.push("", `Sound: ${sentence(s.sound)}`);
  L.push("", `Look: ${cap(look)}${p.style.locked ? [st.palette, st.cameraLanguage, st.atmosphere].filter(Boolean).map((x) => `; ${clean(x)}`).join("") : ""}. ${s.mood} mood.`);
  const keep = continuity(p, s);
  if (keep) L.push(keep);
  L.push(`Length: about ${s.duration} seconds. Aspect ratio ${p.aspect}.`);
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
