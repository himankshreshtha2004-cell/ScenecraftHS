// Makes storyboard frames for many shots in one go.
//  photo  — a real image model (Pollinations for free, or OpenAI) through the Vercel server function
//  sketch — the connected language model draws a storyboard illustration as SVG (works inside Claude, no image model needed)
import { create } from "zustand";
import { useStore } from "../store/store";
import { drawSketch, generateImage } from "./ai";
import { storeBlob } from "./assets";
import { pad } from "./ids";
import { buildImagePrompt } from "./prompt";
import type { Project } from "./types";

export type FrameMode = "photo" | "sketch";
export interface FrameJob { running: boolean; mode: FrameMode; total: number; done: number; failed: number; current: string; cancel: boolean; lastError: string }
export const useFrameJob = create<FrameJob>(() => ({ running: false, mode: "sketch", total: 0, done: 0, failed: 0, current: "", cancel: false, lastError: "" }));

export function frameModes(): FrameMode[] {
  const ai = useStore.getState().ai;
  return [...(ai.image ? (["photo"] as FrameMode[]) : []), ...(ai.text ? (["sketch"] as FrameMode[]) : [])];
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

async function makeOne(p: Project, shotId: string, mode: FrameMode) {
  const s = p.shots.find((x) => x.id === shotId); if (!s) return;
  const st = useStore.getState();
  const prompt = buildImagePrompt(p, s);
  let blob: Blob, name: string, w = 1600, h = 900, tags = ["storyboard", "frame"];
  if (mode === "photo") {
    let r: { b64: string; mime: string } | null = null, lastErr: any;
    for (let k = 0; k < 4 && !r; k++) {
      try { r = await generateImage({ prompt: `Cinematic film still, photorealistic. ${prompt}`, aspect: p.aspect }); }
      catch (e: any) { lastErr = e; if (/busy|429|wait/i.test(e.message)) await sleep(16000); else break; }
    }
    if (!r) throw lastErr ?? new Error("No image");
    const bin = Uint8Array.from(atob(r.b64), (c) => c.charCodeAt(0));
    blob = new Blob([bin], { type: r.mime || "image/jpeg" });
    const bmp = await createImageBitmap(blob).catch(() => null); w = bmp?.width ?? w; h = bmp?.height ?? h; bmp?.close?.();
    name = `AI photo — ${s.title}`;
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
  useFrameJob.setState({ running: true, mode, total: ids.length, done: 0, failed: 0, current: "", cancel: false, lastError: "" });
  const pid = p0.id;
  const queue = [...ids];
  const worker = async () => {
    while (queue.length && !useFrameJob.getState().cancel) {
      const id = queue.shift()!;
      const p = useStore.getState().project;
      if (!p || p.id !== pid) return;
      const s = p.shots.find((x) => x.id === id);
      useFrameJob.setState({ current: s ? `Shot ${pad(p.shots.indexOf(s) + 1)} · ${s.title}` : "" });
      try { await makeOne(p, id, mode); useFrameJob.setState((j) => ({ done: j.done + 1 })); }
      catch (e: any) { useFrameJob.setState((j) => ({ failed: j.failed + 1, done: j.done + 1, lastError: e?.message || String(e) })); }
    }
  };
  // sketches can run a few at a time; free photo services allow one at a time
  await Promise.all(Array.from({ length: mode === "sketch" ? Math.min(3, ids.length) : 1 }, worker));
  const j = useFrameJob.getState();
  useFrameJob.setState({ running: false, current: "" });
  const made = j.done - j.failed;
  if (j.cancel) st.toast(`Stopped — ${made} ${made === 1 ? "frame" : "frames"} made.`, "info");
  else if (j.failed) st.toast(`Made ${made} of ${j.total} frames. ${j.failed} failed: ${j.lastError}`, "error", { label: "Try again", run: () => makeFrames(mode) });
  else st.toast(`Storyboard ready — ${made} ${mode === "photo" ? "photos" : "sketches"} made.`, "ok");
}
