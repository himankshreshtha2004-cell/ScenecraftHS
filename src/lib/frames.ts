// Makes storyboard frames for many shots in one go.
//  photo  — a real image model (Cloudflare FLUX.2 for free, Pollinations or OpenAI) through the Vercel server function.
//  Character reference photos from Cast are sent along so faces and outfits stay the same from shot to shot.
//  (The old "sketch" mode — the text AI drawing SVG — is no longer offered: it only made flat cartoon frames.)
import { create } from "zustand";
import { useStore } from "../store/store";
import { drawSketch, generateImage } from "./ai";
import { blobOf, storeBlob } from "./assets";
import { pad } from "./ids";
import { buildCharacterPrompt, buildImagePrompt, buildLocationPrompt, shotCharacters, shotLocation } from "./prompt";
import type { Project } from "./types";

export type FrameMode = "photo" | "sketch";
export interface FrameJob { running: boolean; mode: FrameMode; total: number; done: number; failed: number; current: string; cancel: boolean; lastError: string }
export const useFrameJob = create<FrameJob>(() => ({ running: false, mode: "sketch", total: 0, done: 0, failed: 0, current: "", cancel: false, lastError: "" }));

export function frameModes(): FrameMode[] {
  const ai = useStore.getState().ai;
  return ai.image ? ["photo"] : [];
}
export const modeLabel = (m: FrameMode) => (m === "photo" ? `photos (${useStore.getState().ai.imageProvider || "image AI"})` : `sketches (drawn by ${useStore.getState().ai.provider || "AI"})`);

/** SVG from a model is untrusted: keep only drawing elements, no scripts, events or external links */
export function sanitizeSVG(raw: string, aspect: string): string {
  const doc = new DOMParser().parseFromString(raw.slice(raw.search(/<svg[\s>]/i)), "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) throw new Error("The drawing wasn't valid SVG.");
  doc.querySelectorAll("script,foreignObject,iframe,image,use[href^='http'],a,animate,set,animateTransform,animateMotion").forEach((n) => n.remove());
  doc.querySelectorAll("style").forEach((n) => { if (/@import|url\(\s*['"]?(?!#)/i.test(n.textContent || "")) n.remove(); });
  doc.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const v = a.value.trim().toLowerCase();
      if (a.name.startsWith("on") || ((a.name === "href" || a.name === "xlink:href") && !v.startsWith("#")) || v.startsWith("javascript:") || /url\(\s*['"]?(?!#)/.test(v)) el.removeAttribute(a.name);
    }
  });
  const [w, h] = aspect.split(":").map(Number);
  if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", `0 0 1600 ${Math.round((1600 * h) / w)}`);
  svg.setAttribute("width", "1600"); svg.setAttribute("height", String(Math.round((1600 * h) / w)));
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(svg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ANIMATED = /anime|animat|cartoon|stylized 3d|pixar|2d|illustrat|stop.?motion|claymation/i;
/** realism words go last so they win over anything vague earlier in the prompt — unless the film is meant to be animated */
function photoPrompt(p: Project, base: string, refNames: string[], kind: "frame" | "portrait" | "place" = "frame") {
  const look = `${p.filmStyle} ${p.style.locked ? p.style.visualStyle : ""}`;
  const refs = refNames.length ? ` ${refNames.map((n, i) => n.startsWith("@place:") ? `The setting looks exactly like the place in image ${i}` : `${n} looks exactly like the person in image ${i}`).join("; ")}.` : "";
  const subject = kind === "place" ? "real places" : "real people";
  const tail = ANIMATED.test(look)
    ? " High-quality, detailed, finished image in the film's style — rich lighting and depth, not a rough sketch."
    : ` Photorealistic live-action ${kind === "portrait" ? "costume and casting photograph" : kind === "place" ? "location photograph" : "movie still"} of ${subject}, natural ${kind === "place" ? "textures" : "skin texture and real fabric"}, shot on a cinema camera, ${kind === "frame" ? "35mm lens, shallow depth of field, motivated practical lighting, " : ""}subtle film grain. Not an illustration, not a cartoon, not a 3D render, not a drawing.`;
  return `${base}${refs}${tail}`;
}

/** shrinks a stored picture under 512 px (what FLUX.2 accepts as a reference) */
async function refOf(id: string): Promise<{ b64: string; mime: string } | null> {
  try {
    const blob = await blobOf(id); if (!blob || blob.type === "image/svg+xml") return null;
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 496 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close?.();
    const url = cv.toDataURL("image/jpeg", 0.86);
    return { b64: url.slice(url.indexOf(",") + 1), mime: "image/jpeg" };
  } catch { return null; }
}

/** the main picture of each character in the shot (up to 3) and of its location — sent along so faces, outfits and places stay the same */
async function shotRefs(p: Project, shotId: string) {
  const s = p.shots.find((x) => x.id === shotId); if (!s) return { refs: [], names: [] as string[] };
  const refs: { b64: string; mime: string }[] = [], names: string[] = [];
  for (const { c } of shotCharacters(p, s)) {
    if (refs.length >= 3) break;
    const id = c.refAssetIds?.[0]; if (!id) continue;
    const r = await refOf(id); if (r) { refs.push(r); names.push(c.name); }
  }
  const { l } = shotLocation(p, s);
  if (l?.refAssetIds?.[0]) { const r = await refOf(l.refAssetIds[0]); if (r) { refs.push(r); names.push("@place:" + l.name); } }
  return { refs, names };
}

/** turns an image-service reply into a stored asset, cropped to the wanted shape */
async function saveGenerated(p: Project, r: { b64: string; mime: string }, aspect: string, name: string, tags: string[]) {
  const bin = Uint8Array.from(atob(r.b64), (c) => c.charCodeAt(0));
  let blob = new Blob([bin], { type: r.mime || "image/jpeg" });
  const bmp = await createImageBitmap(blob).catch(() => null);
  let w = bmp?.width ?? 1024, h = bmp?.height ?? 1024;
  const [aw, ah] = aspect.split(":").map(Number), want = aw / ah;
  if (bmp && Math.abs(w / h - want) / want > 0.04) {
    const cw = w / h > want ? Math.round(h * want) : w, ch = w / h > want ? h : Math.round(w / want);
    const c = document.createElement("canvas"); c.width = cw; c.height = ch;
    c.getContext("2d")!.drawImage(bmp, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch);
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.9));
    if (out) { blob = out; w = cw; h = ch; }
  }
  bmp?.close?.();
  return storeBlob(p.id, blob, { name, mime: blob.type, width: w, height: h, origin: "generated", tags });
}

async function generateWithRetry(input: { prompt: string; aspect: string; refs?: { b64: string; mime: string }[] }) {
  let lastErr: any;
  for (let k = 0; k < 4; k++) {
    try { return await generateImage(input); }
    catch (e: any) { lastErr = e; if (/busy|429|wait/i.test(e.message)) await sleep(16000); else break; }
  }
  throw lastErr ?? new Error("No image");
}

/** a full-body costume/casting picture for one character; it becomes the character's main reference */
export async function makeCharacterPortrait(characterId: string) {
  const st = useStore.getState(); const p = st.project; if (!p) return;
  const c = p.characters.find((x) => x.id === characterId); if (!c) return;
  const r = await generateWithRetry({ prompt: photoPrompt(p, buildCharacterPrompt(p, c), [], "portrait"), aspect: "3:4" });
  const a = await saveGenerated(p, r, "3:4", `AI portrait — ${c.name}`, ["character", "reference"]);
  useStore.getState().update((d) => { d.assets.push(a); const x = d.characters.find((y) => y.id === characterId); if (x) x.refAssetIds = [a.id, ...x.refAssetIds.filter((i) => i !== a.id)]; });
}
/** an establishing picture of one location; it becomes the location's main reference */
export async function makeLocationPhoto(locationId: string) {
  const st = useStore.getState(); const p = st.project; if (!p) return;
  const l = p.locations.find((x) => x.id === locationId); if (!l) return;
  const r = await generateWithRetry({ prompt: photoPrompt(p, buildLocationPrompt(p, l), [], "place"), aspect: p.aspect });
  const a = await saveGenerated(p, r, p.aspect, `AI location — ${l.name}`, ["location", "reference"]);
  useStore.getState().update((d) => { d.assets.push(a); const x = d.locations.find((y) => y.id === locationId); if (x) x.refAssetIds = [a.id, ...x.refAssetIds.filter((i) => i !== a.id)]; });
}

/** which characters and locations (used in the given shots) still have no picture */
export function missingReferences(p: Project, shotIds?: string[]) {
  const shots = shotIds ? p.shots.filter((s) => shotIds.includes(s.id)) : p.shots;
  const chars = p.characters.filter((c) => !c.refAssetIds.length && shots.some((s) => s.characters.some((x) => x.characterId === c.id)));
  const locs = p.locations.filter((l) => !l.refAssetIds.length && shots.some((s) => s.locationId === l.id));
  return { chars, locs };
}

/** makes portraits / location photos for everything listed (one at a time — free image services allow one at a time) */
export async function makeReferences(ids: { chars: string[]; locs: string[] }) {
  const job = useFrameJob.getState(); if (job.running) return;
  const st = useStore.getState(); const p0 = st.project; if (!p0) return;
  const queue = [...ids.chars.map((id) => ({ k: "c" as const, id })), ...ids.locs.map((id) => ({ k: "l" as const, id }))];
  if (!queue.length) return;
  useFrameJob.setState({ running: true, mode: "photo", total: queue.length, done: 0, failed: 0, current: "", cancel: false, lastError: "" });
  for (const q of queue) {
    if (useFrameJob.getState().cancel) break;
    const p = useStore.getState().project; if (!p || p.id !== p0.id) break;
    const nm = q.k === "c" ? p.characters.find((x) => x.id === q.id)?.name : p.locations.find((x) => x.id === q.id)?.name;
    useFrameJob.setState({ current: `${q.k === "c" ? "Portrait" : "Location"} · ${nm ?? ""}` });
    try { await (q.k === "c" ? makeCharacterPortrait(q.id) : makeLocationPhoto(q.id)); useFrameJob.setState((j) => ({ done: j.done + 1 })); }
    catch (e: any) { useFrameJob.setState((j) => ({ failed: j.failed + 1, done: j.done + 1, lastError: e?.message || String(e) })); if (/402|401|403|allowance|rejected|turned off|used up/i.test(e?.message || "")) break; }
  }
  const j = useFrameJob.getState();
  useFrameJob.setState({ running: false, current: "" });
  const made = j.done - j.failed;
  if (j.failed) st.toast(`Made ${made} of ${j.total} reference pictures. ${j.lastError}`, "error");
  else st.toast(`${made} reference ${made === 1 ? "picture" : "pictures"} ready — every shot will now use them.`, "ok");
  return j.failed === 0;
}

async function makeOne(p: Project, shotId: string, mode: FrameMode) {
  const s = p.shots.find((x) => x.id === shotId); if (!s) return;
  const st = useStore.getState();
  const prompt = buildImagePrompt(p, s);
  let blob: Blob, name: string, w = 1600, h = 900, tags = ["storyboard", "frame"];
  if (mode === "photo") {
    const refs = await shotRefs(p, shotId);
    const r = await generateWithRetry({ prompt: photoPrompt(p, prompt, refs.names), aspect: p.aspect, refs: refs.refs });
    const a = await saveGenerated(p, r, p.aspect, `AI photo — ${s.title}`, tags);
    st.update((d) => {
      d.assets.push(a);
      const x = d.shots.find((y) => y.id === shotId); if (!x) return;
      x.imageIds.push(a.id); x.imageId = a.id;
      if (!x.startFrameId) x.startFrameId = a.id;
    });
    return;
  } else {
    const svg = sanitizeSVG(await drawSketch({ prompt, aspect: p.aspect, title: s.title }), p.aspect);
    blob = new Blob([svg], { type: "image/svg+xml" });
    const [aw, ah] = p.aspect.split(":").map(Number); h = Math.round((1600 * ah) / aw);
    name = `AI sketch — ${s.title}`; tags = [...tags, "sketch"];
  }
  const a = await storeBlob(p.id, blob, { name, mime: blob.type, width: w, height: h, origin: "generated", tags });
  st.update((d) => {
    d.assets.push(a);
    const x = d.shots.find((y) => y.id === shotId); if (!x) return;
    x.imageIds.push(a.id); x.imageId = a.id;
    if (!x.startFrameId) x.startFrameId = a.id;
  });
}

/** runs through the given shots (default: every shot without a picture) */
export async function makeFrames(mode: FrameMode, shotIds?: string[]) {
  const job = useFrameJob.getState();
  if (job.running) return;
  const st = useStore.getState();
  const p0 = st.project; if (!p0) return;
  const ids = shotIds ?? p0.shots.filter((s) => !s.imageId).map((s) => s.id);
  if (!ids.length) { st.toast("Every shot already has a frame.", "info"); return; }
  // character portraits and location photos come first, so every frame can match them
  if (mode === "photo") {
    const miss = missingReferences(p0, ids);
    if (miss.chars.length || miss.locs.length) {
      st.toast(`First making ${miss.chars.length ? `${miss.chars.length} character portrait${miss.chars.length > 1 ? "s" : ""}` : ""}${miss.chars.length && miss.locs.length ? " and " : ""}${miss.locs.length ? `${miss.locs.length} location photo${miss.locs.length > 1 ? "s" : ""}` : ""} so every shot looks consistent…`, "info");
      await makeReferences({ chars: miss.chars.map((c) => c.id), locs: miss.locs.map((l) => l.id) });
      if (useFrameJob.getState().cancel) return;
    }
  }
  useFrameJob.setState({ running: true, mode, total: ids.length, done: 0, failed: 0, current: "", cancel: false, lastError: "" });
  const pid = p0.id;
  const queue = [...ids];
  // if photos can't be made at all (used-up allowance, bad key), stop instead of making poor substitutes
  const use: FrameMode = mode;
  let stopped = "";
  const fatal = (m: string) => /402|401|403|credit|pollen|rejected|allowance|turned off|not set|no longer free/i.test(m);
  const worker = async () => {
    while (queue.length && !useFrameJob.getState().cancel) {
      const id = queue.shift()!;
      const p = useStore.getState().project;
      if (!p || p.id !== pid) return;
      const s = p.shots.find((x) => x.id === id);
      useFrameJob.setState({ current: s ? `Shot ${pad(p.shots.indexOf(s) + 1)} · ${s.title}` : "" });
      try { await makeOne(p, id, use); useFrameJob.setState((j) => ({ done: j.done + 1 })); }
      catch (e: any) {
        const msg = e?.message || String(e);
        if (use === "photo" && fatal(msg)) { stopped = msg; queue.length = 0; useFrameJob.setState((j) => ({ failed: j.failed + 1, done: j.done + 1, lastError: msg })); break; }
        useFrameJob.setState((j) => ({ failed: j.failed + 1, done: j.done + 1, lastError: msg }));
      }
    }
  };
  // sketches can run a few at a time; free photo services allow one at a time
  await Promise.all(Array.from({ length: mode === "sketch" ? Math.min(3, ids.length) : 1 }, worker));
  const j = useFrameJob.getState();
  useFrameJob.setState({ running: false, current: "" });
  const made = j.done - j.failed;
  if (stopped) st.toast(`Photos couldn't be made: ${stopped} Meanwhile you can use “Copy image prompts” in Make frames and upload the results.`, "error", { label: "AI settings", run: () => st.setOverlay("settings") });
  else if (j.cancel) st.toast(`Stopped — ${made} ${made === 1 ? "frame" : "frames"} made.`, "info");
  else if (j.failed) st.toast(`Made ${made} of ${j.total} frames. ${j.failed} failed: ${j.lastError}`, "error", { label: "Try again", run: () => makeFrames(mode) });
  else st.toast(`Storyboard ready — ${made} ${use === "photo" ? "photos" : "sketches"} made.`, "ok");
}

/* ------------------------------------------------------------------ ChatGPT (or any image app) by hand */
/** one message to paste into ChatGPT: asks for one image per shot, numbered, with the locked looks repeated */
export function imageBrief(p: Project, only?: string[]) {
  const shots = p.shots.filter((s) => !only || only.includes(s.id));
  const [w, h] = p.aspect.split(":").map(Number);
  const L = [
    `Please make storyboard frames for my short film "${p.title}" — ${shots.length} images, one per shot, in the order below.`,
    `Every image: ${w >= h ? "landscape" : w === h ? "square" : "portrait"} ${p.aspect}, photorealistic cinematic film still, no text or captions. Keep each character's face, hair and outfit exactly the same in every image, and keep each location's look consistent.`,
    `Make them one at a time; after each one I'll say "next".`,
    "",
  ];
  shots.forEach((s) => L.push(`SHOT ${pad(p.shots.indexOf(s) + 1)} — ${s.title}`, buildImagePrompt(p, s), ""));
  return L.join("\n");
}

/** puts several uploaded images onto shots: by the shot number in each file name ("shot_03.png"), otherwise in order */
export async function bulkAssign(files: FileList | File[]) {
  const st = useStore.getState();
  const p = st.project; if (!p) return;
  const list = Array.from(files).filter((f) => f.type.startsWith("image/")).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!list.length) return;
  const numOf = (n: string) => { const m = n.match(/(?:shot|frame|scene)?[ _-]*0*(\d{1,2})(?!\d)/i); return m ? Number(m[1]) : NaN; };
  const byNumber = list.every((f) => !isNaN(numOf(f.name)) && numOf(f.name) >= 1 && numOf(f.name) <= p.shots.length) && new Set(list.map((f) => numOf(f.name))).size === list.length;
  const empty = p.shots.filter((s) => !s.imageId);
  const order = byNumber ? list.map((f) => p.shots[numOf(f.name) - 1]) : (empty.length >= list.length ? empty : p.shots).slice(0, list.length);
  const added = await st.addImages(list, ["storyboard", "frame"]);
  st.update((d) => {
    added.forEach((a, k) => {
      const target = order[k]; if (!target) return;
      const x = d.shots.find((y) => y.id === target.id); if (!x) return;
      x.imageIds.push(a.id); x.imageId = a.id; if (!x.startFrameId) x.startFrameId = a.id;
    });
  });
  st.toast(`Placed ${added.length} ${added.length === 1 ? "image" : "images"} on ${byNumber ? "the shots named in the file names" : "shots in order"}.`, "ok", { label: "Undo", run: () => st.undo() });
}
