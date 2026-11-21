import { DAY_ONLY_LIGHTING, NIGHT_TIMES } from "./options";
import { promptOf, shotCharacters, shotLocation } from "./prompt";
import type { Project, Shot } from "./types";
import { pad } from "./ids";

/* ------------------------------------------------------------------ continuity */
export type Fix =
  | { kind: "wardrobe"; characterId: string; wardrobeId: string }
  | { kind: "architecture" }
  | { kind: "style" }
  | { kind: "lighting"; lighting: string }
  | { kind: "trim"; duration: number }
  | { kind: "relink"; frameId: string | null };

export interface Issue {
  id: string;
  shotId: string;
  shotNo: number;
  severity: "conflict" | "review";
  area: "Character" | "Location" | "Style" | "Lighting" | "Duration" | "Frames";
  title: string;
  message: string;
  fixLabel: string;
  fix: Fix;
  keepLabel: string;
  acknowledged: boolean;
}

export function shotIssues(p: Project, s: Shot): Issue[] {
  const out: Issue[] = [];
  const no = p.shots.indexOf(s) + 1;
  const tag = `Shot ${pad(no)}`;
  const add = (i: Omit<Issue, "shotId" | "shotNo" | "acknowledged">) => out.push({ ...i, shotId: s.id, shotNo: no, acknowledged: s.acknowledged.includes(i.id) });

  for (const { c, w } of shotCharacters(p, s)) {
    if (!c.locked) continue;
    const locked = c.wardrobes.find((x) => x.id === c.lockedWardrobeId);
    if (locked && w && w.id !== locked.id) {
      add({
        id: `wardrobe:${c.id}:${w.id}`, severity: "conflict", area: "Character",
        title: "Character continuity issue",
        message: `${c.name}'s outfit in ${tag} (“${w.name}”) does not match the locked wardrobe (“${locked.name}”).`,
        fixLabel: "Apply locked wardrobe", fix: { kind: "wardrobe", characterId: c.id, wardrobeId: locked.id }, keepLabel: "Keep intentional change",
      });
    }
  }
  const { l } = shotLocation(p, s);
  if (l?.locked && s.architectureOverride.trim() && s.architectureOverride.trim() !== l.architecture.trim()) {
    add({
      id: `arch:${l.id}:${s.architectureOverride.trim().slice(0, 40)}`, severity: "conflict", area: "Location",
      title: "Location continuity issue",
      message: `${tag} uses a different architecture description from the locked ${l.name}.`,
      fixLabel: "Restore location reference", fix: { kind: "architecture" }, keepLabel: "Allow variation",
    });
  }
  if (p.style.locked) {
    const o = s.styleOverride || {};
    const keys = (["visualStyle", "palette", "lighting"] as const).filter((k) => (o[k] || "").trim());
    if (keys.length) {
      const names = { visualStyle: "visual style", palette: "colour palette", lighting: "lighting style" };
      add({
        id: `style:${keys.join(",")}:${keys.map((k) => o[k]).join("|").slice(0, 60)}`, severity: "review", area: "Style",
        title: "Style override",
        message: `${tag} overrides the locked ${keys.map((k) => names[k]).join(" and ")}.`,
        fixLabel: "Restore locked style", fix: { kind: "style" }, keepLabel: "Keep override",
      });
    }
  }
  if (NIGHT_TIMES.includes(s.timeOfDay) && DAY_ONLY_LIGHTING.includes(s.lighting)) {
    add({
      id: `light:${s.timeOfDay}:${s.lighting}`, severity: "review", area: "Lighting",
      title: "Lighting doesn't match time of day",
      message: `${tag} is set at ${s.timeOfDay.toLowerCase()} but lit with ${s.lighting.toLowerCase()}.`,
      fixLabel: "Use moonlight", fix: { kind: "lighting", lighting: "Moonlight" }, keepLabel: "Keep as is",
    });
  }
  if (s.duration > p.credits.maxClip) {
    const n = Math.ceil(s.duration / p.credits.maxClip);
    add({
      id: `dur:${s.duration}:${p.credits.maxClip}`, severity: "review", area: "Duration",
      title: "Longer than one generation",
      message: `${tag} is ${s.duration} s, longer than the ${p.credits.maxClip} s clip length set in the Credit Planner — it would need ${n} generations.`,
      fixLabel: `Trim to ${p.credits.maxClip} s`, fix: { kind: "trim", duration: p.credits.maxClip }, keepLabel: "Keep length",
    });
  }
  if (s.startFromShotId) {
    const prev = p.shots.find((x) => x.id === s.startFromShotId);
    if (!prev || prev.endFrameId !== s.startFrameId) {
      add({
        id: `link:${s.startFromShotId}:${prev?.endFrameId ?? "none"}`, severity: "review", area: "Frames",
        title: "Linked frame changed",
        message: prev ? `The end frame of the shot this start frame came from has changed since you linked it.` : `The shot this start frame was linked from no longer exists.`,
        fixLabel: prev ? "Update link" : "Unlink", fix: { kind: "relink", frameId: prev?.endFrameId ?? null }, keepLabel: "Keep current frame",
      });
    }
  }
  return out;
}

export const projectIssues = (p: Project) => p.shots.flatMap((s) => shotIssues(p, s));

export type ContinuityStatus = "ready" | "review" | "conflict";
export function continuityStatus(issues: Issue[]): ContinuityStatus {
  const open = issues.filter((i) => !i.acknowledged);
  if (open.some((i) => i.severity === "conflict")) return "conflict";
  if (open.length) return "review";
  return "ready";
}
export const STATUS_LABEL: Record<ContinuityStatus, string> = { ready: "Ready", review: "Needs Review", conflict: "Conflict Detected" };

/* ------------------------------------------------------------------ readiness */
export interface Check { key: string; label: string; ok: boolean; na?: boolean; tip: string }

export function readiness(p: Project, s: Shot): { checks: Check[]; ready: boolean; score: number } {
  const chars = shotCharacters(p, s);
  const { l } = shotLocation(p, s);
  const open = shotIssues(p, s).filter((i) => !i.acknowledged);
  const checks: Check[] = [
    { key: "desc", label: "Shot description complete", ok: s.description.trim().length >= 12, tip: "Describe what happens in a sentence or two." },
    { key: "visual", label: "Visual reference assigned", ok: !!(s.imageId || s.startFrameId), tip: "Upload a storyboard image or a start frame." },
    { key: "char", label: "Character reference assigned", ok: chars.every(({ c }) => c.refAssetIds.length > 0), na: chars.length === 0, tip: "Add a reference image to each character in this shot." },
    { key: "loc", label: "Location reference assigned", ok: !!l && l.refAssetIds.length > 0, tip: l ? `Add a reference image to ${l.name}.` : "Choose a location for this shot." },
    { key: "move", label: "Camera movement selected", ok: !!s.movement, tip: "Pick how the camera moves." },
    { key: "dur", label: "Duration selected", ok: s.duration > 0, tip: "Set how long the shot lasts." },
    { key: "prompt", label: "Video prompt prepared", ok: promptOf(p, s).trim().length >= 60, tip: "Open Prompt and check the generated text." },
    { key: "cont", label: "Continuity issues reviewed", ok: open.length === 0, tip: `${open.length} open continuity ${open.length === 1 ? "issue" : "issues"}.` },
  ];
  const counted = checks.filter((c) => !c.na);
  const passed = counted.filter((c) => c.ok).length;
  return { checks, ready: passed === counted.length, score: counted.length ? passed / counted.length : 0 };
}

export function projectReadiness(p: Project) {
  if (!p.shots.length) return 0;
  return p.shots.reduce((a, s) => a + readiness(p, s).score, 0) / p.shots.length;
}

/* ------------------------------------------------------------------ credits */
export function generationsFor(p: Project, s: Shot) {
  return Math.max(1, Math.ceil(s.duration / Math.max(1, p.credits.maxClip)));
}
export function costPerAttempt(p: Project, s: Shot) {
  const c = p.credits;
  return c.mode === "per-second" ? c.credits * s.duration : c.credits * generationsFor(p, s);
}
export function creditTotals(p: Project) {
  const c = p.credits;
  const base = p.shots.reduce((a, s) => a + costPerAttempt(p, s), 0);
  const without = Math.round(base * c.attemptsWithout);
  const withP = Math.round(base * c.attemptsWith);
  return { base, without, with: withP, diff: without - withP, pct: without ? (without - withP) / without : 0 };
}

export const totalDuration = (p: Project) => p.shots.reduce((a, s) => a + (s.duration || 0), 0);
