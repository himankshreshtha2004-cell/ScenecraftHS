// Turns AI answers into SceneCraft data, and SceneCraft data into context for the AI.
import type { ProposedBoard, ProposedShot } from "./ai";
import { pad, uid } from "./ids";
import { FRAMINGS, LIGHTINGS, MOODS, MOVEMENTS, TIMES } from "./options";
import { speakerName } from "./prompt";
import { newShot } from "./sample";
import type { Character, DialogueLine, Location, Project, Shot } from "./types";

const pick = (vals: string[], v: string | undefined, d: string) => (v ? vals.find((x) => x.toLowerCase() === v.toLowerCase().trim()) ?? d : d);
const V = { f: FRAMINGS.map((x) => x.value), m: MOVEMENTS.map((x) => x.value), l: LIGHTINGS.map((x) => x.value), mo: MOODS.map((x) => x.value) };
const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function findChar(p: Project, name: string) {
  const n = norm(name);
  return p.characters.find((c) => norm(c.name) === n) ?? p.characters.find((c) => n && (norm(c.name).includes(n) || n.includes(norm(c.name))));
}
function findLoc(p: Project, name: string) {
  const n = norm(name);
  return p.locations.find((l) => norm(l.name) === n) ?? p.locations.find((l) => n && (norm(l.name).includes(n) || n.includes(norm(l.name))));
}

function newCharacter(name: string, x: Partial<{ role: string; description: string; face: string; hair: string; clothes: string; accessories: string }> = {}, locked = false): Character {
  const w = uid("w_");
  return { id: uid("c_"), name, role: x.role || "", description: x.description || "", face: x.face || "", hair: x.hair || "", accessories: x.accessories || "",
    wardrobes: [{ id: w, name: "Main outfit", clothes: x.clothes || "" }], lockedWardrobeId: w, refAssetIds: [], locked };
}

/** converts one proposed shot; unknown character / location names are created (unlocked) so nothing is lost */
export function shotFromProposal(p: Project, s: ProposedShot, sceneId: string, n: number): Shot {
  const cast = (s.characters || []).map((name) => {
    let c = findChar(p, name);
    if (!c && name.trim() && !/^narrator$/i.test(name.trim())) { c = newCharacter(name.trim()); p.characters.push(c); }
    return c;
  }).filter(Boolean) as Character[];
  let loc: Location | undefined;
  if (s.location?.trim()) {
    loc = findLoc(p, s.location);
    if (!loc) { loc = { id: uid("l_"), name: s.location.trim(), architecture: "", description: "", objects: "", materials: "", palette: "", lighting: "", variants: [], refAssetIds: [], locked: false }; p.locations.push(loc); }
  }
  const dialogue: DialogueLine[] = (s.dialogue || []).filter((d) => d?.line?.trim()).map((d) => {
    const c = findChar(p, d.speaker || "");
    return { id: uid("d_"), speaker: c ? c.id : (d.speaker || "Narrator").trim(), line: d.line.trim(), delivery: (d.delivery || "").trim() };
  });
  return newShot(sceneId, n, {
    title: s.title || `Shot ${n}`, description: s.description || "", duration: Math.max(2, Math.min(15, Math.round(Number(s.duration) || 5))),
    framing: pick(V.f, s.framing, "Medium Shot"), movement: pick(V.m, s.movement, "Static"), lighting: pick(V.l, s.lighting, "Natural Daylight"),
    mood: pick(V.mo, s.mood, "Dramatic"), timeOfDay: pick(TIMES, s.timeOfDay, "Afternoon"), motion: s.motion || "",
    characters: [...new Map(cast.map((c) => [c.id, { characterId: c.id, wardrobeId: c.lockedWardrobeId }])).values()],
    locationId: loc?.id ?? null, dialogue, sound: s.sound || "",
  });
}

/** fills a fresh project with an AI-written film: locked characters, locations and style so every prompt stays consistent */
export function boardToProject(base: Project, b: ProposedBoard): Project {
  const p = structuredClone(base);
  if (b.title && (!base.title || base.title === "Untitled film")) p.title = b.title;
  p.logline = b.logline || "";
  p.characters = (b.characters || []).slice(0, 8).map((c) => newCharacter(c.name, c, true));
  p.locations = (b.locations || []).slice(0, 8).map((l) => ({ id: uid("l_"), name: l.name, architecture: l.architecture || "", description: l.description || "", objects: l.objects || "", materials: "", palette: "", lighting: l.lighting || "", variants: [], refAssetIds: [], locked: true }));
  if (b.style) p.style = { ...p.style, locked: true, visualStyle: b.style.visualStyle || p.filmStyle, palette: b.style.palette || "", cameraLanguage: b.style.cameraLanguage || "", lighting: b.style.lighting || "", atmosphere: b.style.atmosphere || "" };
  p.scenes = []; p.shots = [];
  (b.scenes || []).forEach((sc) => {
    const scene = { id: uid("sc_"), title: sc.title || `Scene ${p.scenes.length + 1}`, summary: sc.summary || "" };
    p.scenes.push(scene);
    (sc.shots || []).forEach((s) => p.shots.push(shotFromProposal(p, s, scene.id, p.shots.length + 1)));
  });
  if (!p.shots.length) throw new Error("The AI didn't return any shots. Try again or add more detail to your idea.");
  p.ui.selectedShotId = p.shots[0].id;
  p.ui.view = "script";
  return p;
}

/** a compact text summary of the film so far, for continuing the story or writing a shot's dialogue */
export function storyContext(p: Project, focusShotId?: string) {
  const L: string[] = [];
  L.push(`Title: ${p.title}`, `Idea: ${p.concept}`, p.logline ? `Logline: ${p.logline}` : "", `Genre: ${p.genre}. Look: ${p.filmStyle}. Aspect ${p.aspect}.`);
  L.push("", "Cast:", ...(p.characters.length ? p.characters.map((c) => `- ${c.name}${c.role ? ` (${c.role})` : ""}: ${c.description}`) : ["- (none yet)"]));
  L.push("", "Locations:", ...(p.locations.length ? p.locations.map((l) => `- ${l.name}: ${l.description}`) : ["- (none yet)"]));
  L.push("", "Story so far:");
  p.scenes.forEach((sc, k) => {
    const shots = p.shots.filter((s) => s.sceneId === sc.id);
    if (!shots.length) return;
    L.push(`Scene ${k + 1} — ${sc.title}${sc.summary ? `: ${sc.summary}` : ""}`);
    shots.forEach((s) => {
      const i = p.shots.indexOf(s);
      L.push(`  ${s.id === focusShotId ? ">>> " : ""}Shot ${pad(i + 1)} (${s.duration}s, ${s.framing}${s.characters.length ? `, with ${s.characters.map((c) => speakerName(p, c.characterId)).join(", ")}` : ""}): ${s.description || s.title}`);
      s.dialogue.forEach((d) => L.push(`     ${speakerName(p, d.speaker)}${d.delivery ? ` (${d.delivery})` : ""}: "${d.line}"`));
    });
  });
  return L.filter(Boolean).join("\n");
}
