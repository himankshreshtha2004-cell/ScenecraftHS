import { useStore } from "../store/store";
import type { Fix } from "./checks";
import { pad, uid } from "./ids";
import { buildVideoPrompt } from "./prompt";
import { newShot } from "./sample";
import type { Project, Shot } from "./types";

const st = () => useStore.getState();
const find = (p: Project, id: string) => p.shots.find((s) => s.id === id)!;

export function updateShot(id: string, fn: (s: Shot, p: Project) => void, coalesce?: string) {
  st().update((p) => { const s = p.shots.find((x) => x.id === id); if (s) fn(s, p); }, coalesce ? `${coalesce}:${id}` : undefined);
}

export function addShot(afterId?: string | null) {
  let nid = "";
  st().update((p) => {
    const i = afterId ? p.shots.findIndex((s) => s.id === afterId) : p.shots.length - 1;
    const ref = p.shots[i];
    const scene = ref?.sceneId ?? p.scenes[0]?.id ?? (p.scenes.push({ id: uid("sc_"), title: "Scene 1", summary: "" }), p.scenes[0].id);
    const s = newShot(scene, p.shots.length + 1, ref ? {
      timeOfDay: ref.timeOfDay, lighting: ref.lighting, mood: ref.mood, locationId: ref.locationId, locationVariantId: ref.locationVariantId,
      characters: ref.characters.map((c) => ({ ...c })), title: "New shot", duration: ref.duration,
    } : { title: "New shot" });
    p.shots.splice(i + 1, 0, s);
    nid = s.id;
    p.ui.selectedShotId = s.id;
  });
  st().toast("Shot added.", "ok");
  return nid;
}

export function duplicateShot(id: string) {
  st().update((p) => {
    const i = p.shots.findIndex((s) => s.id === id); if (i < 0) return;
    const c: Shot = { ...structuredClone(p.shots[i]), id: uid("s_"), title: p.shots[i].title + " (copy)", status: "draft", promptVersions: [], startFromShotId: null, acknowledged: [] };
    p.shots.splice(i + 1, 0, c);
    p.ui.selectedShotId = c.id;
  });
  st().toast("Shot duplicated.", "ok");
}

export function deleteShot(id: string) {
  const p0 = st().project; if (!p0) return;
  const i = p0.shots.findIndex((s) => s.id === id);
  const title = p0.shots[i]?.title;
  st().update((p) => {
    p.shots = p.shots.filter((s) => s.id !== id);
    p.shots.forEach((s) => { if (s.startFromShotId === id) s.startFromShotId = null; });
    if (p.ui.selectedShotId === id) p.ui.selectedShotId = p.shots[Math.min(i, p.shots.length - 1)]?.id ?? null;
  });
  st().toast(`Deleted “${title}”.`, "info", { label: "Undo", run: () => st().undo() });
}

export function moveShot(fromId: string, toId: string) {
  st().update((p) => {
    const a = p.shots.findIndex((s) => s.id === fromId), b = p.shots.findIndex((s) => s.id === toId);
    if (a < 0 || b < 0 || a === b) return;
    const [s] = p.shots.splice(a, 1);
    p.shots.splice(b, 0, s);
    // a shot dropped between two shots of another scene joins that scene
    const prev = p.shots[b - 1], next = p.shots[b + 1];
    if (prev && next && prev.sceneId === next.sceneId && prev.sceneId !== s.sceneId) s.sceneId = prev.sceneId;
    else if (!prev && next && next.sceneId !== s.sceneId && !p.shots.some((x) => x !== s && x.sceneId === s.sceneId)) s.sceneId = next.sceneId;
  });
}

export function setStatus(id: string, status: Shot["status"]) {
  updateShot(id, (s) => { s.status = status; });
}

export function applyFix(shotId: string, fix: Fix) {
  updateShot(shotId, (s, p) => {
    if (fix.kind === "wardrobe") { const c = s.characters.find((x) => x.characterId === fix.characterId); if (c) c.wardrobeId = fix.wardrobeId; }
    if (fix.kind === "architecture") s.architectureOverride = "";
    if (fix.kind === "style") s.styleOverride = {};
    if (fix.kind === "lighting") s.lighting = fix.lighting;
    if (fix.kind === "trim") s.duration = fix.duration;
    if (fix.kind === "relink") { if (fix.frameId) s.startFrameId = fix.frameId; else s.startFromShotId = null; }
    if (fix.kind === "addChar") { const c = p.characters.find((x) => x.id === fix.characterId); if (c && !s.characters.some((x) => x.characterId === c.id)) s.characters.push({ characterId: c.id, wardrobeId: c.lockedWardrobeId }); }
  });
}
export function acknowledge(shotId: string, issueId: string, on = true) {
  updateShot(shotId, (s) => { s.acknowledged = on ? Array.from(new Set([...s.acknowledged, issueId])) : s.acknowledged.filter((x) => x !== issueId); });
}

export function savePromptVersion(id: string, label?: string) {
  updateShot(id, (s, p) => {
    const text = s.promptText ?? buildVideoPrompt(p, s);
    s.promptVersions.unshift({ id: uid("pv_"), label: label || `Version ${s.promptVersions.length + 1}`, text, createdAt: Date.now() });
  });
}

export const shotLabel = (p: Project, id: string) => `Shot ${pad(p.shots.findIndex((s) => s.id === id) + 1)}`;
export { find };
