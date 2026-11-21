import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAssetUrls } from "../lib/assets";
import { fmtDur, pad } from "../lib/ids";
import { aspectRatio } from "../lib/options";
import { cleanUnusedAssets, useStore } from "../store/store";
import { Button, cx, Field, Input, IconButton, Modal, Pill, Switch } from "./ui";

/* ------------------------------------------------------------------ animatic preview */
const MOVES: Record<string, [Record<string, string>, Record<string, string>]> = {
  "Dolly In": [{ transform: "scale(1)" }, { transform: "scale(1.14)" }],
  "Dolly Out": [{ transform: "scale(1.14)" }, { transform: "scale(1)" }],
  "Pan Left": [{ transform: "scale(1.1) translateX(4%)" }, { transform: "scale(1.1) translateX(-4%)" }],
  "Pan Right": [{ transform: "scale(1.1) translateX(-4%)" }, { transform: "scale(1.1) translateX(4%)" }],
  "Tilt Up": [{ transform: "scale(1.1) translateY(-4%)" }, { transform: "scale(1.1) translateY(4%)" }],
  "Tilt Down": [{ transform: "scale(1.1) translateY(4%)" }, { transform: "scale(1.1) translateY(-4%)" }],
  "Tracking Shot": [{ transform: "scale(1.08) translateX(-3%)" }, { transform: "scale(1.12) translateX(3%)" }],
  Orbit: [{ transform: "scale(1.12) rotate(-1.5deg) translateX(-2%)" }, { transform: "scale(1.12) rotate(1.5deg) translateX(2%)" }],
  Crane: [{ transform: "scale(1.12) translateY(-5%)" }, { transform: "scale(1.04) translateY(2%)" }],
  Handheld: [{ transform: "scale(1.06) translate(-.6%, .4%)" }, { transform: "scale(1.07) translate(.6%, -.4%)" }],
  Static: [{ transform: "scale(1)" }, { transform: "scale(1)" }],
};

export function PreviewOverlay() {
  const p = useStore((s) => s.project);
  const open = useStore((s) => s.overlay === "preview");
  const urls = useAssetUrls((s) => s.urls);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [el, setEl] = useState(0);
  const last = useRef(0);
  const close = () => useStore.getState().setOverlay(null);
  useEffect(() => { if (open && p) { const k = p.shots.findIndex((s) => s.id === p.ui.selectedShotId); setI(Math.max(0, k)); setEl(0); setPlaying(true); } }, [open]); // eslint-disable-line
  const shot = p?.shots[i];
  useEffect(() => {
    if (!open || !playing || !shot || !p) return;
    let raf = 0; last.current = performance.now();
    const tick = (t: number) => {
      const dt = (t - last.current) / 1000; last.current = t;
      setEl((e) => {
        const n = e + dt;
        if (n >= shot.duration) { if (i < p.shots.length - 1) { setI(i + 1); return 0; } setPlaying(false); return shot.duration; }
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, playing, i, shot?.duration]); // eslint-disable-line
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === " ") { e.preventDefault(); setPlaying((x) => !x); }
      if (e.key === "ArrowRight" && p) { setI((x) => Math.min(p.shots.length - 1, x + 1)); setEl(0); }
      if (e.key === "ArrowLeft") { setI((x) => Math.max(0, x - 1)); setEl(0); }
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [open, p]);
  if (!open || !p || !shot) return null;
  const start = shot.startFrameId ?? shot.imageId, end = shot.endFrameId && shot.endFrameId !== start ? shot.endFrameId : null;
  const mv = MOVES[shot.movement] ?? MOVES.Static;
  const rm = useStore.getState().prefs.reduceMotion;
  const k = Math.min(1, el / shot.duration);
  const lerp = mv[0].transform === mv[1].transform || rm ? mv[0].transform : undefined;
  const total = p.shots.reduce((a, s) => a + s.duration, 0);
  const before = p.shots.slice(0, i).reduce((a, s) => a + s.duration, 0);
  return (
    <div className="fixed inset-0 z-[85] bg-black flex flex-col" role="dialog" aria-label="Storyboard preview">
      <div className="flex items-center gap-3 px-5 h-14 text-white/80">
        <span className="font-serif text-[22px] text-white">{p.title}</span>
        <Pill tone="neutral">Animatic preview</Pill>
        <span className="text-[12.5px] text-white/45">Camera moves are simulated on your storyboard images — not generated video.</span>
        <span className="flex-1" />
        <IconButton label="Close preview (Esc)" onClick={close}><X className="h-5 w-5" /></IconButton>
      </div>
      <div className="flex-1 min-h-0 grid place-items-center px-10">
        <div className="relative overflow-hidden bg-[#0b0b0e] rounded-md shadow-2xl" style={{ aspectRatio: String(aspectRatio(p.aspect)), height: "min(100%, calc((100vw - 80px) / " + aspectRatio(p.aspect) + "))" }}>
          {start ? (
            <motion.div key={shot.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <img src={urls[start]} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ transform: lerp ?? interp(mv[0].transform, mv[1].transform, k) }} />
              {end && <img src={urls[end]} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: Math.max(0, (k - 0.35) / 0.65), transform: lerp ?? interp(mv[0].transform, mv[1].transform, k) }} />}
            </motion.div>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-white/40 text-sm">No image for this shot yet</div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/85 to-transparent">
            <div className="text-[12px] font-semibold tracking-[.18em] text-amber">SHOT {pad(i + 1)} · {shot.framing.toUpperCase()} · {shot.movement.toUpperCase()}</div>
            <div className="text-white text-[20px] font-semibold mt-1">{shot.title}</div>
            <div className="text-white/70 text-[14px] mt-1 max-w-3xl">{shot.description}</div>
          </div>
        </div>
      </div>
      <div className="px-6 pb-5 pt-4">
        <div className="flex gap-1 h-1.5">
          {p.shots.map((s, j) => (
            <button key={s.id} onClick={() => { setI(j); setEl(0); }} className="h-full rounded-full bg-white/15 overflow-hidden" style={{ flex: s.duration }} aria-label={`Go to shot ${j + 1}`}>
              <span className="block h-full bg-amber" style={{ width: j < i ? "100%" : j === i ? `${k * 100}%` : "0%" }} />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-white/70">
          <IconButton label="Previous shot" onClick={() => { setI(Math.max(0, i - 1)); setEl(0); }}><ChevronLeft className="h-5 w-5" /></IconButton>
          <button onClick={() => { if (!playing && i === p.shots.length - 1 && el >= shot.duration) { setI(0); setEl(0); } setPlaying(!playing); }} className="h-10 w-10 rounded-full bg-white text-black grid place-items-center" aria-label={playing ? "Pause (Space)" : "Play (Space)"}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}</button>
          <IconButton label="Next shot" onClick={() => { setI(Math.min(p.shots.length - 1, i + 1)); setEl(0); }}><ChevronRight className="h-5 w-5" /></IconButton>
          <span className="text-[13px] tabular-nums ml-2">{fmtDur(before + el)} / {fmtDur(total)}</span>
          <span className="flex-1" />
          <span className="text-[12px] text-white/40">Space play/pause · ← → shots · Esc close</span>
        </div>
      </div>
    </div>
  );
}
function interp(a: string, b: string, k: number) {
  const na = a.match(/-?[\d.]+/g)?.map(Number) ?? [], nb = b.match(/-?[\d.]+/g)?.map(Number) ?? [];
  let n = 0;
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  return a.replace(/-?[\d.]+/g, () => { const v = na[n] + ((nb[n] ?? na[n]) - na[n]) * e; n++; return v.toFixed(4); });
}

/* ------------------------------------------------------------------ settings */
export function SettingsOverlay() {
  const open = useStore((s) => s.overlay === "settings");
  const prefs = useStore((s) => s.prefs), ai = useStore((s) => s.ai), p = useStore((s) => s.project);
  const st = useStore.getState();
  const [ep, setEp] = useState(() => { try { return localStorage.getItem("scenecraft.aiEndpoint") || ""; } catch { return ""; } });
  const [checking, setChecking] = useState(false);
  return (
    <Modal open={open} onClose={() => st.setOverlay(null)} title="Settings" width={640}>
      <div className="space-y-6">
        <section>
          <h3 className="text-[14px] font-semibold">AI services <span className="text-faint font-normal">(optional)</span></h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Status on={ai.text} l="Storyboard & Prompt Assistant" d={ai.text ? `Connected · ${ai.provider}` : "Not connected"} />
            <Status on={ai.image} l="Storyboard image generation" d={ai.image ? `Connected · ${ai.imageProvider}` : "Not connected"} />
          </div>
          <p className="text-[13px] text-mute mt-3 leading-relaxed"><span className="text-ink">Opened inside Claude,</span> SceneCraft uses Claude to write films, scenes and dialogue — no key needed (Claude asks your permission the first time). <span className="text-ink">On your own Vercel site,</span> AI switches on with the server function (<span className="font-mono text-[12px]">api/ai.js</span>, included). Keys go in Vercel → Project → Settings → Environment Variables, stay on the server and never reach the browser. Redeploy after adding one.</p>
          <div className="mt-3 rounded-xl border border-line bg-surface divide-y divide-line text-[13px]">
            {[
              ["Free", "Google Gemini", "Storyboard + Prompt Assistant", "GEMINI_API_KEY", "https://aistudio.google.com/apikey", "aistudio.google.com/apikey"],
              ["Free", "Groq", "Storyboard + Prompt Assistant", "GROQ_API_KEY", "https://console.groq.com/keys", "console.groq.com/keys"],
              ["Free, no key", "Pollinations", "Storyboard images", "on automatically", "https://enter.pollinations.ai", "enter.pollinations.ai (optional, higher limits)"],
              ["Paid", "Anthropic / OpenAI", "Text / images", "ANTHROPIC_API_KEY · OPENAI_API_KEY", "", ""],
            ].map(([tag, name, what, env, href, link]) => (
              <div key={name} className="flex items-center gap-3 px-3.5 py-2.5">
                <Pill tone={tag.startsWith("Free") ? "ok" : "neutral"}>{tag}</Pill>
                <div className="flex-1 min-w-0"><div className="font-medium">{name} <span className="text-faint font-normal">· {what}</span></div>
                  <div className="text-[12px] text-faint"><span className="font-mono text-ink/80">{env}</span>{href && <> · {name === "Pollinations" ? "key" : "get a key"} at <a href={href} target="_blank" rel="noreferrer" className="text-amber hover:underline">{link}</a></>}</div></div>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-faint mt-2">Free tiers have daily limits set by each provider. Image generation only works on Vercel; inside Claude, make start frames in your image tool and upload them.</p>
          <Field label="AI endpoint (leave empty for the built-in /api/ai)" className="mt-3">
            <div className="flex gap-2"><Input value={ep} onChange={(e) => setEp(e.target.value)} placeholder="./api/ai" />
              <Button disabled={checking} icon={<RefreshCw className={cx("h-4 w-4", checking && "animate-spin")} />} onClick={async () => { try { ep.trim() ? localStorage.setItem("scenecraft.aiEndpoint", ep.trim()) : localStorage.removeItem("scenecraft.aiEndpoint"); } catch { /* */ } setChecking(true); await st.refreshAI(); setChecking(false); }}>Check</Button></div>
          </Field>
        </section>
        <section className="space-y-3">
          <h3 className="text-[14px] font-semibold">Workspace</h3>
          <Toggle l="Advanced mode" d="Opens the advanced shot settings (style overrides, architecture, notes) by default." v={prefs.advanced} on={(v) => st.setPrefs({ advanced: v })} />
          <Toggle l="Reduce motion" d="Turns off animations and the animatic's simulated camera moves." v={prefs.reduceMotion} on={(v) => st.setPrefs({ reduceMotion: v })} />
          <Toggle l="Show shot inspector" d="The settings panel on the right of the storyboard." v={prefs.inspector} on={(v) => st.setPrefs({ inspector: v })} />
        </section>
        <section>
          <h3 className="text-[14px] font-semibold">Storage</h3>
          <p className="text-[13px] text-mute mt-1">Projects and images are saved in this browser (IndexedDB). Download a backup from Projects to move work to another computer.</p>
          {p && <Button size="sm" className="mt-3" onClick={async () => { const n = await cleanUnusedAssets(); st.toast(n ? `Removed ${n} unused images.` : "No unused images to remove.", "ok"); }}>Remove unused images from “{p.title}”</Button>}
        </section>
      </div>
    </Modal>
  );
}
function Status({ on, l, d }: { on: boolean; l: string; d: string }) {
  return <div className={cx("rounded-xl border p-3", on ? "border-ok/35 bg-ok-soft" : "border-line bg-surface")}><div className="text-[13px] font-medium">{l}</div><div className={cx("text-[12.5px] mt-0.5", on ? "text-ok" : "text-faint")}>{d}</div></div>;
}
function Toggle({ l, d, v, on }: { l: string; d: string; v: boolean; on: (v: boolean) => void }) {
  return <div className="flex items-center gap-4"><div className="flex-1"><div className="text-[13.5px] font-medium">{l}</div><div className="text-[12.5px] text-faint">{d}</div></div><Switch label={l} checked={v} onChange={on} /></div>;
}

/* ------------------------------------------------------------------ shortcuts */
export function ShortcutsOverlay() {
  const open = useStore((s) => s.overlay === "shortcuts");
  const rows: [string, string[]][] = [
    ["Undo / Redo", ["Ctrl", "Z"]], ["Redo", ["Ctrl", "Shift", "Z"]], ["Save now", ["Ctrl", "S"]], ["Play preview", ["P"]],
    ["Toggle sidebar", ["["]], ["Toggle inspector", ["]"]], ["Go to section 1–9", ["Alt", "1–9"]], ["Show shortcuts", ["?"]],
    ["Storyboard: select previous / next shot", ["←", "→"]], ["Storyboard: open shot editor", ["Enter"]], ["Storyboard: new shot", ["N"]],
    ["Storyboard: duplicate shot", ["D"]], ["Storyboard: approve / un-approve", ["A"]], ["Storyboard: delete shot", ["Del"]], ["Storyboard: pick up / drop a shot to reorder", ["Space"]],
  ];
  return (
    <Modal open={open} onClose={() => useStore.getState().setOverlay(null)} title="Keyboard shortcuts" width={520}>
      <ul className="divide-y divide-line">{rows.map(([l, k]) => <li key={l} className="flex items-center justify-between py-2.5 text-[13.5px]"><span className="text-mute">{l}</span><span className="flex gap-1">{k.map((x) => <kbd key={x} className="kbd">{x}</kbd>)}</span></li>)}</ul>
    </Modal>
  );
}
