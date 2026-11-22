// Records the storyboard animatic (the Preview) as a real video file in the browser:
// each shot's frame is drawn on a canvas with its simulated camera move, then captured with MediaRecorder.
import { blobOf } from "./assets";
import { pad } from "./ids";
import { dialogueLines } from "./prompt";
import type { Project, Shot } from "./types";

type Move = { s: number; x: number; y: number; r: number };
/** same simulated camera moves as the Preview (scale, x/y shift as a share of the frame, rotation in degrees) */
const MOVES: Record<string, [Move, Move]> = {
  "Dolly In": [{ s: 1, x: 0, y: 0, r: 0 }, { s: 1.14, x: 0, y: 0, r: 0 }],
  "Dolly Out": [{ s: 1.14, x: 0, y: 0, r: 0 }, { s: 1, x: 0, y: 0, r: 0 }],
  "Pan Left": [{ s: 1.1, x: 0.04, y: 0, r: 0 }, { s: 1.1, x: -0.04, y: 0, r: 0 }],
  "Pan Right": [{ s: 1.1, x: -0.04, y: 0, r: 0 }, { s: 1.1, x: 0.04, y: 0, r: 0 }],
  "Tilt Up": [{ s: 1.1, x: 0, y: -0.04, r: 0 }, { s: 1.1, x: 0, y: 0.04, r: 0 }],
  "Tilt Down": [{ s: 1.1, x: 0, y: 0.04, r: 0 }, { s: 1.1, x: 0, y: -0.04, r: 0 }],
  "Tracking Shot": [{ s: 1.08, x: -0.03, y: 0, r: 0 }, { s: 1.12, x: 0.03, y: 0, r: 0 }],
  Orbit: [{ s: 1.12, x: -0.02, y: 0, r: -1.5 }, { s: 1.12, x: 0.02, y: 0, r: 1.5 }],
  Crane: [{ s: 1.12, x: 0, y: -0.05, r: 0 }, { s: 1.04, x: 0, y: 0.02, r: 0 }],
  Handheld: [{ s: 1.06, x: -0.006, y: 0.004, r: 0 }, { s: 1.07, x: 0.006, y: -0.004, r: 0 }],
  Static: [{ s: 1, x: 0, y: 0, r: 0 }, { s: 1, x: 0, y: 0, r: 0 }],
};
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

export interface AnimaticOptions { titles: boolean; subtitles: boolean; onProgress?: (done: number, total: number) => void; signal?: { cancel: boolean } }

export function videoFormat(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const [mime, ext] of [["video/mp4;codecs=avc1.42E01E", "mp4"], ["video/mp4", "mp4"], ["video/webm;codecs=vp9", "webm"], ["video/webm;codecs=vp8", "webm"], ["video/webm", "webm"]] as const)
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}

async function loadImage(id: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!id) return null;
  const blob = await blobOf(id); if (!blob) return null;
  const url = URL.createObjectURL(blob);
  const img = new Image();
  try { img.src = url; await img.decode(); return img; } catch { return null; } finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
}

function sizeFor(aspect: string) {
  const [a, b] = aspect.split(":").map(Number); const r = a && b ? a / b : 16 / 9;
  const even = (n: number) => Math.round(n / 2) * 2;
  return r >= 1 ? { W: 1280, H: even(1280 / r) } : { W: even(1280 * r), H: 1280 };
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number, m: Move, alpha: number) {
  if (alpha <= 0) return;
  const iw = img.naturalWidth || W, ih = img.naturalHeight || H;
  const k = Math.max(W / iw, H / ih);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W / 2 + m.x * W, H / 2 + m.y * H);
  ctx.rotate((m.r * Math.PI) / 180);
  ctx.scale(m.s, m.s);
  ctx.drawImage(img, (-iw * k) / 2, (-ih * k) / 2, iw * k, ih * k);
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/), lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; if (lines.length === maxLines) break; } else cur = t;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  return lines;
}

/** plays every shot in real time on a hidden canvas and returns the recorded video */
export async function recordAnimatic(p: Project, opt: AnimaticOptions): Promise<{ blob: Blob; ext: string }> {
  const fmt = videoFormat();
  if (!fmt) throw new Error("This browser can't record video. Use Chrome or Edge on a computer.");
  const { W, H } = sizeFor(p.aspect);
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const shots: { s: Shot; a: HTMLImageElement | null; b: HTMLImageElement | null; lines: string[] }[] = [];
  for (const s of p.shots) {
    const startId = s.startFrameId ?? s.imageId;
    const endId = s.endFrameId && s.endFrameId !== startId ? s.endFrameId : null;
    const lines = dialogueLines(p, s).map((d) => `${d.who}: ${d.line}`);
    shots.push({ s, a: await loadImage(startId), b: await loadImage(endId), lines });
  }
  const total = p.shots.reduce((a, s) => a + s.duration, 0);
  if (!total) throw new Error("There are no shots to record.");

  const draw = (t: number) => {
    let acc = 0, idx = 0;
    while (idx < shots.length - 1 && t >= acc + shots[idx].s.duration) { acc += shots[idx].s.duration; idx++; }
    const { s, a, b, lines } = shots[idx];
    const el = Math.min(s.duration, t - acc), k = Math.min(1, el / s.duration);
    const [m0, m1] = MOVES[s.movement] ?? MOVES.Static, e = ease(k);
    const m = { s: m0.s + (m1.s - m0.s) * e, x: m0.x + (m1.x - m0.x) * e, y: m0.y + (m1.y - m0.y) * e, r: m0.r + (m1.r - m0.r) * e };
    ctx.fillStyle = "#0b0b0e"; ctx.fillRect(0, 0, W, H);
    const fadeIn = Math.min(1, el / 0.4);
    if (a) drawCover(ctx, a, W, H, m, fadeIn);
    else { ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.font = `${Math.round(H * 0.03)}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText("No image for this shot yet", W / 2, H / 2); ctx.textAlign = "left"; }
    if (b) drawCover(ctx, b, W, H, m, Math.max(0, (k - 0.35) / 0.65) * fadeIn);
    const u = H / 720;
    if (opt.titles) {
      const g = ctx.createLinearGradient(0, H * 0.58, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.82)");
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.58, W, H * 0.42);
      const x = 40 * u; let y = H - 40 * u;
      ctx.font = `${15 * u}px system-ui, sans-serif`; ctx.fillStyle = "rgba(255,255,255,.72)";
      const desc = wrap(ctx, s.description || "", W - 2 * x, 2);
      for (let n = desc.length - 1; n >= 0; n--) { ctx.fillText(desc[n], x, y); y -= 21 * u; }
      ctx.font = `600 ${22 * u}px system-ui, sans-serif`; ctx.fillStyle = "#fff"; ctx.fillText(s.title, x, y - 4 * u); y -= 32 * u;
      ctx.font = `600 ${12 * u}px system-ui, sans-serif`; ctx.fillStyle = "#e8a86b";
      ctx.fillText(`SHOT ${pad(idx + 1)} · ${s.framing.toUpperCase()} · ${s.movement.toUpperCase()}`, x, y);
    }
    if (opt.subtitles && lines.length) {
      // spread the shot's lines evenly over its duration
      const line = lines[Math.min(lines.length - 1, Math.floor((el / s.duration) * lines.length))];
      ctx.font = `500 ${20 * u}px system-ui, sans-serif`; ctx.textAlign = "center";
      const sub = wrap(ctx, line, W * 0.8, 2);
      let y = opt.titles ? H * 0.55 : H - 50 * u - (sub.length - 1) * 28 * u;
      for (const l of sub) {
        const w = ctx.measureText(l).width;
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(W / 2 - w / 2 - 10 * u, y - 22 * u, w + 20 * u, 30 * u);
        ctx.fillStyle = "#fff"; ctx.fillText(l, W / 2, y); y += 32 * u;
      }
      ctx.textAlign = "left";
    }
  };

  draw(0);
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 6_000_000 });
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
  rec.start(1000);
  const t0 = performance.now();
  await new Promise<void>((res) => {
    // a timer keeps drawing even if the window loses focus (as long as the tab stays open)
    const iv = window.setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      if (opt.signal?.cancel || t >= total + 0.15) { window.clearInterval(iv); draw(Math.min(t, total - 0.001)); res(); return; }
      draw(t); opt.onProgress?.(Math.min(t, total), total);
    }, 1000 / 30);
  });
  rec.stop(); await stopped;
  stream.getTracks().forEach((t) => t.stop());
  if (opt.signal?.cancel) throw new Error("cancelled");
  return { blob: new Blob(parts, { type: fmt.mime.split(";")[0] }), ext: fmt.ext };
}
