import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRightLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Copy, Download, FileText, Grid3x3, History, Images, Link2,
  Loader2, RotateCcw, Save, Sparkles, Star, Trash2, Upload, Wand2, X,
} from "lucide-react";
import { useState } from "react";
import { create } from "zustand";
import { LibraryPicker } from "../components/Library";
import ShotInspector, { StatusPill } from "../components/ShotInspector";
import { AssetImg, Button, Card, cx, DropSlot, Field, FileButton, IconButton, Input, Pill, Progress, Segmented, Select, TextArea } from "../components/ui";
import { assistPrompt, generateImage, type PromptSuggestion } from "../lib/ai";
import { costPerAttempt, readiness, shotIssues, type Issue } from "../lib/checks";
import { copyText, download } from "../lib/download";
import { ago, pad, slug } from "../lib/ids";
import { MOVEMENTS } from "../lib/options";
import { acknowledge, applyFix, savePromptVersion, setStatus, updateShot } from "../lib/ops";
import { buildImagePrompt, buildVideoPrompt, diffWords, promptOf, shotCharacters, shotLocation, tokenEstimate } from "../lib/prompt";
import type { Project, Shot } from "../lib/types";
import { useStore } from "../store/store";
import { attachImage } from "./Storyboard";

export type Tab = "preview" | "frames" | "prompt" | "check";
export const useEditorTab = create<{ tab: Tab }>(() => ({ tab: "preview" }));
const setTabG = (t: Tab) => useEditorTab.setState({ tab: t });

export default function ShotEditor() {
  const p = useStore((s) => s.project)!;
  const st = useStore.getState();
  const shot = p.shots.find((s) => s.id === p.ui.selectedShotId) ?? p.shots[0];
  const tab = useEditorTab((x) => x.tab), setTab = setTabG;
  if (!shot) { st.go("storyboard"); return null; }
  const idx = p.shots.indexOf(shot);
  const r = readiness(p, shot);
  const go = (d: number) => { const n = p.shots[idx + d]; if (n) st.setUI({ selectedShotId: n.id }); };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="h-14 shrink-0 flex items-center gap-3 px-6 border-b border-line">
          <Button tone="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => st.go("storyboard")}>Storyboard</Button>
          <span className="text-faint">/</span>
          <span className="font-serif text-[22px] leading-none">{pad(idx + 1)}</span>
          <span className="text-[15px] font-semibold truncate min-w-[60px] flex-1">{shot.title}</span>
          <span className="shrink-0"><StatusPill status={shot.status} /></span>
          <IconButton label="Previous shot" disabled={idx === 0} onClick={() => go(-1)}><ChevronLeft className="h-4 w-4" /></IconButton>
          <IconButton label="Next shot" disabled={idx === p.shots.length - 1} onClick={() => go(1)}><ChevronRight className="h-4 w-4" /></IconButton>
          <button onClick={() => setTab("check")} className={cx("shrink-0 inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[12.5px] font-semibold", r.ready ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>
            {r.ready ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}<span className="whitespace-nowrap">{r.ready ? <>Ready<span className="hidden xl:inline"> for video generation</span></> : "Needs attention"}</span>
          </button>
          {shot.status === "approved"
            ? <Button tone="ok" size="sm" icon={<Check className="h-4 w-4" />} onClick={() => setStatus(shot.id, "review")} title="Approved — click to move back to review">Approved</Button>
            : <Button tone="primary" size="sm" icon={<Check className="h-4 w-4" />} onClick={() => { setStatus(shot.id, "approved"); st.toast(`Shot ${pad(idx + 1)} approved.`, "ok"); }}>Approve shot</Button>}
        </div>
        <div className="px-6 pt-4 shrink-0">
          <Segmented value={tab} onChange={setTab} options={[
            { value: "preview", label: <><Images className="h-4 w-4" />Storyboard image</> },
            { value: "frames", label: <><ArrowRightLeft className="h-4 w-4" />Frame planner</> },
            { value: "prompt", label: <><Sparkles className="h-4 w-4" />Prompt</> },
            { value: "check", label: <><CheckCircle2 className="h-4 w-4" />Readiness <span className="text-faint tabular-nums">{r.checks.filter((c) => c.ok && !c.na).length}/{r.checks.filter((c) => !c.na).length}</span></> },
          ]} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto thin-scroll">
          <AnimatePresence mode="wait">
            <motion.div key={tab + shot.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="px-6 py-5">
              {tab === "preview" && <PreviewTab p={p} s={shot} />}
              {tab === "frames" && <FramesTab p={p} s={shot} />}
              {tab === "prompt" && <PromptTab p={p} s={shot} />}
              {tab === "check" && <CheckTab p={p} s={shot} setTab={setTab} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <ShotInspector key={shot.id} shot={shot} inEditor />
    </div>
  );
}

/* ------------------------------------------------------------------ storyboard image + versions */
function PreviewTab({ p, s }: { p: Project; s: Shot }) {
  const st = useStore.getState();
  const ai = useStore((x) => x.ai);
  const [lib, setLib] = useState(false);
  const [compare, setCompare] = useState<[string, string] | null>(null);
  const [gen, setGen] = useState(false);
  const imgPrompt = buildImagePrompt(p, s);
  const pickVersion = (id: string) => updateShot(s.id, (x) => { x.imageId = id; });
  const removeVersion = (id: string) => updateShot(s.id, (x) => { x.imageIds = x.imageIds.filter((y) => y !== id); if (x.imageId === id) x.imageId = x.imageIds[x.imageIds.length - 1] ?? null; });
  const generate = async () => {
    setGen(true);
    try {
      const r = await generateImage({ prompt: imgPrompt, aspect: p.aspect });
      const a = await st.addGenerated(r.b64, r.mime, `AI image — ${s.title}`, ["storyboard"]);
      if (a) { updateShot(s.id, (x) => { x.imageIds.push(a.id); x.imageId = a.id; }); st.toast("New image version added.", "ok"); }
    } catch (e: any) { st.toast(`Image generation failed: ${e.message}`, "error"); } finally { setGen(false); }
  };
  return (
    <div className="max-w-[1100px] mx-auto">
      {compare ? (
        <div>
          <div className="flex items-center justify-between mb-3"><div className="text-sm font-semibold">Compare versions</div><Button size="sm" tone="ghost" icon={<X className="h-4 w-4" />} onClick={() => setCompare(null)}>Close compare</Button></div>
          <div className="grid grid-cols-2 gap-4">
            {compare.map((id, k) => (
              <div key={k}>
                <Select value={id} onChange={(v) => setCompare((c) => (c ? (k ? [c[0], v] : [v, c[1]]) as [string, string] : c))} options={s.imageIds.map((x, i) => ({ value: x, label: `Version ${i + 1}${x === s.imageId ? " (preferred)" : ""}` }))} className="mb-2" />
                <AssetImg id={id} assets={p.assets} aspect={p.aspect} />
                <Button size="sm" tone={id === s.imageId ? "ok" : "subtle"} className="mt-2" icon={id === s.imageId ? <Star className="h-4 w-4 fill-current" /> : <Star className="h-4 w-4" />} onClick={() => pickVersion(id)}>{id === s.imageId ? "Preferred version" : "Use this version"}</Button>
              </div>
            ))}
          </div>
        </div>
      ) : s.imageId ? (
        <AssetImg id={s.imageId} assets={p.assets} aspect={p.aspect} className="rounded-2xl ring-1 ring-white/5 max-h-[62vh] mx-auto" fit="cover" />
      ) : (
        <DropSlot aspect={p.aspect} onFiles={(f) => attachImage(s.id, f)} label="Add a storyboard image for this shot" sub="Drop an image here, or click to choose one. You can add several versions." className="max-h-[62vh] mx-auto" />
      )}

      <div className="mt-5 flex items-center gap-2 flex-wrap">
        <div className="text-[13px] font-semibold mr-2">Versions <span className="text-faint font-normal">{s.imageIds.length}</span></div>
        {s.imageIds.map((id, i) => (
          <div key={id} className="relative group">
            <button onClick={() => pickVersion(id)} aria-label={`Use version ${i + 1}`} className={cx("block w-[120px] rounded-lg overflow-hidden ring-2 transition", id === s.imageId ? "ring-amber" : "ring-transparent hover:ring-line")}>
              <AssetImg id={id} assets={p.assets} aspect={p.aspect} rounded="rounded-none" label={false} />
            </button>
            {id === s.imageId && <Star className="absolute left-1.5 top-1.5 h-3.5 w-3.5 text-amber fill-amber drop-shadow" />}
            <button onClick={() => removeVersion(id)} aria-label={`Remove version ${i + 1} from this shot`} className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-panel border border-line grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 text-mute hover:text-bad"><X className="h-3 w-3" /></button>
          </div>
        ))}
        <span className="flex-1" />
        {s.imageIds.length >= 2 && <Button size="sm" tone="subtle" icon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => setCompare([s.imageIds[0], s.imageIds[1]])}>Compare</Button>}
        <FileButton size="sm" multiple icon={<Upload className="h-4 w-4" />} onFiles={(f) => attachImage(s.id, f)}>Upload version</FileButton>
        <Button size="sm" tone="subtle" icon={<Images className="h-4 w-4" />} onClick={() => setLib(true)}>From library</Button>
        {ai.image
          ? <Button size="sm" tone="ai" disabled={gen} icon={gen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} onClick={generate}>{gen ? "Generating…" : `Generate with ${ai.imageProvider || "AI"}`}</Button>
          : <button className="text-[12.5px] text-ai hover:underline" onClick={() => st.setOverlay("settings")}>Connect an image generator</button>}
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-ai" /><div className="text-sm font-semibold flex-1">Storyboard image prompt</div>
          <Button size="sm" tone="ghost" icon={<Copy className="h-4 w-4" />} onClick={async () => { await copyText(imgPrompt); st.toast("Image prompt copied.", "ok"); }}>Copy</Button>
        </div>
        <p className="text-[13.5px] text-mute leading-relaxed mt-2">{imgPrompt}</p>
        <p className="text-[12px] text-faint mt-3">Use this in any image tool to make a still for this shot, then upload it as a version. It's built from the shot settings, locked characters, location and style.</p>
      </Card>
      <LibraryPicker p={p} open={lib} onClose={() => setLib(false)} onPick={(id) => updateShot(s.id, (x) => { if (!x.imageIds.includes(id)) x.imageIds.push(id); x.imageId = id; })} />
    </div>
  );
}

/* ------------------------------------------------------------------ frame planner */
function FrameSlot({ p, s, which, grid }: { p: Project; s: Shot; which: "start" | "end"; grid?: boolean }) {
  const [lib, setLib] = useState(false);
  const id = which === "start" ? s.startFrameId : s.endFrameId;
  const set = (v: string | null) => updateShot(s.id, (x) => { if (which === "start") { x.startFrameId = v; x.startFromShotId = null; } else x.endFrameId = v; });
  const linked = which === "start" && s.startFromShotId ? p.shots.findIndex((x) => x.id === s.startFromShotId) : -1;
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] font-bold tracking-[.16em] text-ink/80">{which === "start" ? "START FRAME" : "END FRAME"}</div>
        {linked >= 0 && <Pill tone="ai"><Link2 className="h-3 w-3" />From Shot {pad(linked + 1)} end frame</Pill>}
      </div>
      {id ? <AssetImg id={id} assets={p.assets} aspect={p.aspect}>{grid && <ThirdsLines />}</AssetImg> : <DropSlot aspect={p.aspect} onFiles={(f) => attachImage(s.id, f, which)} label={`Add ${which} frame`} sub={which === "start" ? "What the first frame of the clip looks like" : "Where the clip should end up"} />}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <FileButton size="sm" icon={<Upload className="h-4 w-4" />} onFiles={(f) => attachImage(s.id, f, which)}>{id ? "Replace" : "Upload"}</FileButton>
        <Button size="sm" tone="subtle" icon={<Images className="h-4 w-4" />} onClick={() => setLib(true)}>Reference image</Button>
        {id && <Button size="sm" tone="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => set(null)}>Clear</Button>}
      </div>
      <LibraryPicker p={p} open={lib} onClose={() => setLib(false)} onPick={set} title={`Choose the ${which} frame`} />
    </div>
  );
}

function FramesTab({ p, s }: { p: Project; s: Shot }) {
  const st = useStore.getState();
  const idx = p.shots.indexOf(s);
  const prev = p.shots[idx - 1];
  const [mode, setMode] = useState<"side" | "overlay">("side");
  const [mix, setMix] = useState(50);
  const [grid, setGrid] = useState(true);
  const usePrev = () => {
    if (!prev?.endFrameId) return;
    updateShot(s.id, (x) => { x.startFrameId = prev.endFrameId; x.startFromShotId = prev.id; });
    st.toast(`Start frame linked to Shot ${pad(idx)}'s end frame.`, "ok");
  };
  return (
    <div className="max-w-[1180px] mx-auto">
      <div className="flex items-start gap-6">
        <div className="flex-1">
          <h2 className="text-[19px] font-semibold">Frame planner</h2>
          <p className="text-sm text-mute mt-1 max-w-2xl">Plan where the clip starts and ends. Start and end frames give video tools a clear target and keep cuts between shots consistent.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button tone="ai" icon={<Link2 className="h-4 w-4" />} disabled={!prev?.endFrameId} onClick={usePrev}
            title={!prev ? "This is the first shot" : !prev.endFrameId ? `Shot ${pad(idx)} has no end frame yet` : undefined}>Use Previous Shot's End Frame</Button>
        </div>
      </div>
      {!prev ? <p className="text-[12.5px] text-faint mt-2">This is the first shot, so there's no previous end frame to reuse.</p> : !prev.endFrameId && <p className="text-[12.5px] text-faint mt-2">Shot {pad(idx)} doesn't have an end frame yet — add one there to reuse it here.</p>}

      <div className="flex items-center gap-3 mt-5">
        <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "side", label: "Side by side" }, { value: "overlay", label: "Compare composition" }]} />
        <button onClick={() => setGrid(!grid)} aria-pressed={grid} className={cx("inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px]", grid ? "text-ink bg-white/[.06]" : "text-mute hover:text-ink")}><Grid3x3 className="h-4 w-4" />Thirds grid</button>
        {mode === "overlay" && (
          <label className="flex items-center gap-2 text-[12.5px] text-mute ml-2">Start<input type="range" min={0} max={100} value={mix} onChange={(e) => setMix(Number(e.target.value))} className="w-48" aria-label="Blend between start and end frame" />End</label>
        )}
      </div>

      {mode === "side" ? (
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 mt-4 items-start relative">
          <FrameSlot p={p} s={s} which="start" grid={grid} />
          <div className="pt-[22%] text-faint flex flex-col items-center gap-1"><ChevronRight className="h-6 w-6" /><span className="text-[11px] tabular-nums">{s.duration}s</span></div>
          <FrameSlot p={p} s={s} which="end" grid={grid} />
        </div>
      ) : (
        <div className="mt-4 max-w-[820px]">
          {s.startFrameId && s.endFrameId ? (
            <div className="relative">
              <AssetImg id={s.startFrameId} assets={p.assets} aspect={p.aspect} label={false} />
              <div className="absolute inset-0" style={{ opacity: mix / 100 }}><AssetImg id={s.endFrameId} assets={p.assets} aspect={p.aspect} label={false} /></div>
              {grid && <ThirdsLines />}
            </div>
          ) : <p className="text-sm text-mute rounded-xl border border-dashed border-line p-8 text-center">Add both a start and an end frame to compare their composition.</p>}
          <p className="text-[12px] text-faint mt-2">Blend the two frames to check that subjects, horizon and eyelines line up — or move the way you intend.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 mt-7">
        <Field label="Motion — what connects the two frames?" hint="This text is added to the video prompt.">
          <TextArea minRows={3} value={s.motion} onChange={(e) => updateShot(s.id, (x) => { x.motion = e.target.value; }, "motion")} placeholder="She turns from the window toward the door as the camera pushes in." />
        </Field>
        <div className="space-y-4">
          <Field label="Camera movement"><Select value={s.movement} onChange={(v) => updateShot(s.id, (x) => { x.movement = v; })} options={MOVEMENTS.map((m) => ({ value: m.value, label: m.value }))} /></Field>
          <Field label="Frame notes"><Input value={s.frameNotes} onChange={(e) => updateShot(s.id, (x) => { x.frameNotes = e.target.value; }, "fnotes")} placeholder="e.g. Keep the lamp in the top-left third" /></Field>
        </div>
      </div>
      <p className="text-[12.5px] text-faint mt-4 flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-ok" />Frames are saved automatically and included in START_END_FRAMES/ when you export the production kit.</p>
    </div>
  );
}
const ThirdsLines = () => (
  <div className="pointer-events-none absolute inset-0">
    {[33.33, 66.66].map((v) => <div key={"v" + v} className="absolute top-0 bottom-0 w-px bg-white/25" style={{ left: `${v}%` }} />)}
    {[33.33, 66.66].map((v) => <div key={"h" + v} className="absolute left-0 right-0 h-px bg-white/25" style={{ top: `${v}%` }} />)}
  </div>
);

/* ------------------------------------------------------------------ prompt */
function PromptTab({ p, s }: { p: Project; s: Shot }) {
  const st = useStore.getState();
  const ai = useStore((x) => x.ai);
  const structured = buildVideoPrompt(p, s);
  const text = promptOf(p, s);
  const edited = s.promptText != null && s.promptText !== structured;
  const [cmp, setCmp] = useState<string | null>(null);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState<PromptSuggestion | null>(null);
  const chars = shotCharacters(p, s), { l } = shotLocation(p, s);
  const sources: [string, boolean, string][] = [
    ["Shot description", !!s.description.trim(), ""],
    ...chars.map(({ c }) => [c.name, true, c.locked ? "locked" : ""] as [string, boolean, string]),
    [l ? l.name : "No location", !!l, l?.locked ? "locked" : ""],
    ["Visual style", true, p.style.locked ? "locked" : ""],
    [`${s.framing}`, true, ""], [`${s.movement}`, true, ""], [s.lighting, true, ""], [`${s.duration}s`, true, ""],
    ["Motion", !!s.motion.trim(), ""], ["Continuity", chars.some(({ c }) => c.locked) || !!l?.locked || p.style.locked, ""],
  ];
  const ver = s.promptVersions.find((v) => v.id === cmp);
  const runAssist = async () => {
    if (!ask.trim()) return;
    setBusy(true); setSugg(null);
    try {
      const locked = [...chars.filter(({ c }) => c.locked).map(({ c }) => `${c.name} (appearance and wardrobe)`), ...(l?.locked ? [`${l.name} (location)`] : []), ...(p.style.locked ? ["visual style"] : [])];
      setSugg(await assistPrompt({ request: ask, prompt: text, locked, shot: { title: s.title, description: s.description, framing: s.framing, movement: s.movement, lighting: s.lighting, mood: s.mood, timeOfDay: s.timeOfDay, motion: s.motion } }));
    } catch (e: any) { st.toast(`Prompt Assistant: ${e.message}`, "error"); } finally { setBusy(false); }
  };
  const apply = () => {
    if (!sugg) return;
    updateShot(s.id, (x) => {
      const c = sugg.changes || {};
      (["framing", "movement", "lighting", "mood", "timeOfDay", "motion"] as const).forEach((k) => { if (c[k]) (x as any)[k] = c[k]; });
      x.promptText = sugg.prompt;
    });
    setSugg(null); setAsk(""); st.toast("Suggestion applied. Save a version if you want to keep the old one.", "ok");
  };

  return (
    <div className="max-w-[1100px] mx-auto grid grid-cols-[1fr_300px] gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-[19px] font-semibold flex-1">Video generation prompt</h2>
          {edited ? <Pill tone="amber">Edited by you</Pill> : <Pill tone="ok">Built from shot settings</Pill>}
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-surface focus-within:border-amber/50 transition-colors">
          <TextArea minRows={8} value={text} aria-label="Video prompt"
            onChange={(e) => updateShot(s.id, (x) => { x.promptText = e.target.value; }, "prompt")}
            className="!border-0 !bg-transparent !ring-0 !text-[15px] !leading-[26px] px-5 py-4" />
          <div className="flex items-center gap-3 px-4 py-3 border-t border-line text-[12px] text-faint">
            <span>{text.split(/\s+/).filter(Boolean).length} words</span><span>·</span><span>~{tokenEstimate(text)} tokens</span><span>·</span>
            <span>Est. {costPerAttempt(p, s)} credits per attempt <span className="text-faint/80">(your Credit Planner numbers)</span></span>
          </div>
        </div>
        {edited && <p className="text-[12.5px] text-mute mt-2">You've edited this prompt, so changes to the shot settings aren't added automatically. <button className="text-amber hover:underline" onClick={() => setCmp("__structured")}>See what changed</button></p>}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Button tone="primary" icon={<Copy className="h-4 w-4" />} onClick={async () => { await copyText(text); st.toast("Prompt copied — paste it into your video tool.", "ok"); }}>Copy Prompt</Button>
          <Button icon={<Save className="h-4 w-4" />} onClick={() => { savePromptVersion(s.id); st.toast("Prompt version saved.", "ok"); }}>Save Version</Button>
          <Button icon={<RotateCcw className="h-4 w-4" />} disabled={s.promptText == null} onClick={() => updateShot(s.id, (x) => { x.promptText = null; })}>Reset to Structured Prompt</Button>
          <Button tone="ghost" icon={<Download className="h-4 w-4" />} onClick={() => download(new Blob([text + "\n"], { type: "text/plain" }), `SHOT_${pad(p.shots.indexOf(s) + 1)}_${slug(s.title)}_prompt.txt`)}>Export Prompt</Button>
        </div>

        {cmp && (
          <Card className="mt-5 p-5">
            <div className="flex items-center gap-2 mb-3"><ArrowRightLeft className="h-4 w-4 text-ai" /><div className="text-sm font-semibold flex-1">{cmp === "__structured" ? "Structured prompt → your edited prompt" : `“${ver?.label}” → current prompt`}</div><IconButton label="Close compare" onClick={() => setCmp(null)}><X className="h-4 w-4" /></IconButton></div>
            <p className="text-[14px] leading-[24px]">
              {diffWords(cmp === "__structured" ? structured : ver?.text ?? "", text).map((d, i) => <span key={i} className={d.k === "add" ? "bg-ok/20 text-ok rounded-sm" : d.k === "del" ? "bg-bad/15 text-bad line-through rounded-sm" : "text-mute"}>{d.t}</span>)}
            </p>
            <div className="flex gap-4 mt-3 text-[12px] text-faint"><span><span className="text-ok">green</span> added</span><span><span className="text-bad line-through">red</span> removed</span></div>
          </Card>
        )}

        <Card className="mt-5 p-5 border-ai/25">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-ai" /><div className="text-sm font-semibold">Prompt Assistant</div>{ai.text && <Pill tone="ai">{ai.provider || "AI"}</Pill>}</div>
          {ai.text ? (
            <>
              <form onSubmit={(e) => { e.preventDefault(); runAssist(); }} className="flex gap-2 mt-3">
                <Input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="What would you like to change? e.g. Make it more dramatic with a low-angle shot" />
                <Button tone="ai" type="submit" disabled={busy || !ask.trim()} icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}>Suggest</Button>
              </form>
              {sugg && (
                <div className="mt-4 rounded-xl border border-ai/30 bg-ai-soft/40 p-4">
                  <div className="text-[13px] font-semibold text-ai">Suggestion</div>
                  <p className="text-[13px] text-mute mt-1">{sugg.summary}</p>
                  {Object.entries(sugg.changes || {}).filter(([, v]) => v).length > 0 && (
                    <ul className="mt-2 text-[13px] space-y-0.5">{Object.entries(sugg.changes).filter(([, v]) => v).map(([k, v]) => <li key={k}><span className="text-faint">{k}:</span> {(s as any)[k]} → <span className="text-ink">{v}</span></li>)}</ul>
                  )}
                  <p className="text-[13.5px] leading-[23px] mt-3">{diffWords(text, sugg.prompt).map((d, i) => <span key={i} className={d.k === "add" ? "bg-ok/20 text-ok" : d.k === "del" ? "bg-bad/15 text-bad line-through" : "text-mute"}>{d.t}</span>)}</p>
                  <p className="text-[12px] text-faint mt-3">Nothing changes until you apply it. Locked character, location and style details stay in place.</p>
                  <div className="flex gap-2 mt-3"><Button tone="ai" size="sm" icon={<Check className="h-4 w-4" />} onClick={apply}>Apply suggestion</Button><Button tone="ghost" size="sm" onClick={() => setSugg(null)}>Discard</Button></div>
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] text-mute mt-2 leading-relaxed">The assistant needs a connected language model. Without one, change the settings on the right — framing, movement, lighting, mood, motion — and the prompt rebuilds itself. <button className="text-ai hover:underline" onClick={() => st.setOverlay("settings")}>How to connect AI</button></p>
          )}
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-4">
          <div className="text-[13px] font-semibold mb-2.5">Built from</div>
          <div className="flex flex-wrap gap-1.5">
            {sources.map(([n, on, tag], i) => <span key={i} className={cx("inline-flex items-center gap-1 h-6 px-2 rounded-md text-[12px] border", on ? "border-line text-ink/85 bg-white/[.03]" : "border-dashed border-line text-faint")}>{n}{tag && <span className="text-ok text-[10.5px] font-semibold uppercase">{tag}</span>}</span>)}
          </div>
          <p className="text-[12px] text-faint mt-3">Change any of these on the right and the prompt updates (unless you've edited it by hand).</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><History className="h-4 w-4 text-mute" /><div className="text-[13px] font-semibold flex-1">Versions</div><span className="text-[12px] text-faint">{s.promptVersions.length}</span></div>
          {s.promptVersions.length ? (
            <ul className="space-y-1.5">
              {s.promptVersions.map((v) => (
                <li key={v.id} className={cx("rounded-lg border px-3 py-2", cmp === v.id ? "border-ai/50 bg-ai-soft/30" : "border-line")}>
                  <div className="flex items-center gap-2"><span className="text-[13px] font-medium flex-1 truncate">{v.label}</span><span className="text-[11.5px] text-faint">{ago(v.createdAt)}</span></div>
                  <p className="text-[12px] text-faint line-clamp-2 mt-0.5">{v.text}</p>
                  <div className="flex gap-3 mt-1.5 text-[12px]">
                    <button className="text-ai hover:underline" onClick={() => setCmp(v.id)}>Compare</button>
                    <button className="text-amber hover:underline" onClick={() => { updateShot(s.id, (x) => { x.promptText = v.text; }); st.toast(`Restored “${v.label}”.`, "ok"); }}>Restore</button>
                    <button className="text-faint hover:text-bad ml-auto" onClick={() => updateShot(s.id, (x) => { x.promptVersions = x.promptVersions.filter((y) => y.id !== v.id); })}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-[12.5px] text-faint">Save a version before big changes so you can compare or go back.</p>}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ readiness + continuity */
export function IssueRow({ i, compact }: { i: Issue; compact?: boolean }) {
  return (
    <div className={cx("rounded-xl border p-3.5", i.acknowledged ? "border-line bg-surface/50 opacity-70" : i.severity === "conflict" ? "border-bad/35 bg-bad-soft" : "border-warn/30 bg-warn-soft")}>
      <div className="flex items-start gap-2.5">
        <CircleAlert className={cx("h-4 w-4 mt-0.5 shrink-0", i.acknowledged ? "text-faint" : i.severity === "conflict" ? "text-bad" : "text-warn")} />
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold">{i.title}{!compact && <span className="text-faint font-normal"> · Shot {pad(i.shotNo)}</span>}</div>
          <p className="text-[13px] text-mute mt-0.5">{i.message}</p>
          {i.acknowledged ? (
            <div className="flex items-center gap-3 mt-2 text-[12.5px]"><span className="text-faint">Marked as intentional</span><button className="text-amber hover:underline" onClick={() => acknowledge(i.shotId, i.id, false)}>Undo</button></div>
          ) : (
            <div className="flex gap-2 mt-2.5">
              <Button size="sm" tone="primary" onClick={() => applyFix(i.shotId, i.fix)}>{i.fixLabel}</Button>
              <Button size="sm" tone="subtle" onClick={() => acknowledge(i.shotId, i.id)}>{i.keepLabel}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckTab({ p, s, setTab }: { p: Project; s: Shot; setTab: (t: Tab) => void }) {
  const st = useStore.getState();
  const r = readiness(p, s);
  const issues = shotIssues(p, s);
  const fixes: Record<string, () => void> = {
    desc: () => document.querySelector<HTMLTextAreaElement>('aside[aria-label="Shot inspector"] textarea')?.focus(),
    visual: () => setTab("preview"), char: () => st.go("characters"), loc: () => (shotLocation(p, s).l ? st.go("locations") : document.querySelector<HTMLSelectElement>('aside[aria-label="Shot inspector"] select')?.focus()),
    move: () => setTab("frames"), dur: () => undefined, prompt: () => setTab("prompt"), cont: () => undefined,
  };
  return (
    <div className="max-w-[900px] mx-auto">
      <div className={cx("rounded-2xl border p-6 flex items-center gap-5", r.ready ? "border-ok/40 bg-ok-soft" : "border-warn/30 bg-warn-soft")}>
        {r.ready ? <CheckCircle2 className="h-10 w-10 text-ok shrink-0" /> : <CircleAlert className="h-10 w-10 text-warn shrink-0" />}
        <div className="flex-1">
          <div className={cx("text-[13px] font-bold tracking-[.16em]", r.ready ? "text-ok" : "text-warn")}>{r.ready ? "READY FOR VIDEO GENERATION" : "NEEDS ATTENTION"}</div>
          <p className="text-[13.5px] text-mute mt-1">{r.ready ? "The plan for this shot is complete." : `${r.checks.filter((c) => !c.ok && !c.na).length} things left to plan.`} Ready means the planning information is complete — it doesn't guarantee how the AI video will turn out.</p>
        </div>
        <div className="w-40"><Progress value={r.score} tone={r.ready ? "ok" : "amber"} /></div>
      </div>
      <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-surface">
        {r.checks.map((c) => (
          <li key={c.key} className="flex items-center gap-3 px-5 py-3.5">
            <span className={cx("grid place-items-center h-6 w-6 rounded-full shrink-0", c.na ? "bg-white/[.05] text-faint" : c.ok ? "bg-ok/20 text-ok" : "bg-white/[.06] text-faint")}>{c.ok || c.na ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>
            <div className="flex-1">
              <div className={cx("text-[14px]", c.na ? "text-faint" : c.ok ? "text-ink" : "text-ink")}>{c.label}{c.na && <span className="text-faint"> — not needed (no characters)</span>}</div>
              {!c.ok && !c.na && <div className="text-[12.5px] text-faint">{c.tip}</div>}
            </div>
            {!c.ok && !c.na && c.key !== "cont" && c.key !== "dur" && <Button size="sm" tone="ghost" onClick={fixes[c.key]}>Fix</Button>}
          </li>
        ))}
      </ul>
      <h3 className="text-[15px] font-semibold mt-8 mb-3">Continuity for this shot</h3>
      {issues.length ? <div className="space-y-2.5">{issues.map((i) => <IssueRow key={i.id} i={i} compact />)}</div>
        : <p className="text-sm text-mute rounded-xl border border-line bg-surface p-4 flex items-center gap-2"><Check className="h-4 w-4 text-ok" />No continuity issues. Checks compare this shot's settings with your locked characters, locations and style — they don't inspect the images.</p>}
    </div>
  );
}
