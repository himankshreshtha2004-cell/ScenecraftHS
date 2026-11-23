import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Logo } from "../components/Shell";
import { Button, cx, Input, TextArea } from "../components/ui";
import { writeFilm } from "../lib/ai";
import { frameModes, makeFrames } from "../lib/frames";
import { boardToProject } from "../lib/aiapply";
import { ASPECTS, DURATIONS, FILM_STYLES, GENRES } from "../lib/options";
import { emptyProject } from "../lib/sample";
import type { Aspect, Complexity } from "../lib/types";
import { useStore } from "../store/store";

function Chips({ value, onChange, options, custom, setCustom, label }: { value: string; onChange: (v: string) => void; options: string[]; custom: string; setCustom: (v: string) => void; label: string }) {
  const isCustom = value === "__custom";
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} role="radio" aria-checked={value === o} onClick={() => onChange(o)}
          className={cx("h-9 px-3.5 rounded-full border text-[13.5px] font-medium transition-colors", value === o ? "bg-amber text-[#1b1208] border-amber" : "border-line text-ink/85 hover:border-[#4a4e5d] hover:bg-white/[.03]")}>{o}</button>
      ))}
      <button role="radio" aria-checked={isCustom} onClick={() => onChange("__custom")}
        className={cx("h-9 px-3.5 rounded-full border text-[13.5px] font-medium transition-colors", isCustom ? "bg-amber text-[#1b1208] border-amber" : "border-dashed border-line text-mute hover:text-ink")}>Custom</button>
      {isCustom && <Input autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={`Your ${label.toLowerCase()}`} className="!h-9 !w-56 !rounded-full" aria-label={`Custom ${label}`} />}
    </div>
  );
}

export default function NewFilm() {
  const st = useStore.getState();
  const ai = useStore((s) => s.ai);
  const [concept, setConcept] = useState("");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("Mystery"), [genreC, setGenreC] = useState("");
  const [style, setStyle] = useState("Cinematic Realism"), [styleC, setStyleC] = useState("");
  const [dur, setDur] = useState<number | "custom">(30), [durC, setDurC] = useState("45");
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [cx_, setCx] = useState<Complexity>("balanced");
  const [count, setCount] = useState<number | "auto">("auto");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const duration = dur === "custom" ? Math.max(5, Math.min(600, Number(durC) || 30)) : dur;
  const per = cx_ === "simple" ? 8 : cx_ === "balanced" ? 6 : 4;
  const shotCount = count === "auto" ? Math.max(3, Math.min(24, Math.round(duration / per))) : count;

  async function create(useAI: boolean) {
    if (!concept.trim()) { st.toast("Describe your film first — a sentence is enough.", "error"); return; }
    const g = genre === "__custom" ? genreC.trim() || "Custom" : genre;
    const fs = style === "__custom" ? styleC.trim() || "Custom" : style;
    const base = emptyProject({ title: title.trim() || "Untitled film", concept: concept.trim(), genre: g, filmStyle: fs, aspect, targetDuration: duration, complexity: cx_, shotCount: count === "auto" ? undefined : count });
    if (useAI) {
      setBusy(true); setProgress(0);
      try {
        const b = await writeFilm({ concept: concept.trim(), genre: g, filmStyle: fs, duration, complexity: cx_, aspect, title: title.trim() || undefined, shots: count === "auto" ? undefined : count }, setProgress);
        const p = boardToProject(base, b);
        await st.createProject(p);
        st.go("storyboard");
        const modes = frameModes();
        if (modes.length) { st.toast(`${ai.provider || "AI"} wrote ${p.scenes.length} scenes, ${p.shots.length} shots and their dialogue. Now making a storyboard frame for each shot…`, "info"); makeFrames(modes[0]); }
        else st.toast(`${ai.provider || "AI"} wrote ${p.scenes.length} scenes, ${p.shots.length} shots and their dialogue.`, "info");
      } catch (e: any) {
        setBusy(false);
        st.toast(`Writing the film didn't work (${e.message}).`, "error", { label: "Start with blank shots", run: () => st.createProject(base) });
      }
      return;
    }
    await st.createProject(base);
    st.toast(`Set up ${base.shots.length} blank shots for you to fill in.`, "ok");
  }

  return (
    <div className="h-full overflow-y-auto thin-scroll">
      <div className="max-w-[920px] mx-auto px-4 md:px-8 py-8">
        <div className="flex items-center justify-between">
          <Button tone="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => st.metas.length ? st.go("studio") : st.setScreen("welcome")}>Back</Button>
          <Logo size={26} />
          <span className="w-20" />
        </div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-serif text-[64px] leading-none text-center mt-12">What's your film about?</h1>
          <p className="text-center text-mute mt-4">Start with an idea. SceneCraft helps you write it and plan every shot.</p>
          <div className="mt-10 rounded-2xl bg-surface border border-line p-2 focus-within:border-amber/50 focus-within:ring-4 focus-within:ring-amber/10 transition">
            <TextArea autoFocus minRows={4} value={concept} onChange={(e) => setConcept(e.target.value)} aria-label="Film concept"
              placeholder="Describe your story, an idea, or a scene you want to bring to life..."
              className="!bg-transparent !border-0 !ring-0 !text-[19px] !leading-[30px] px-4 py-3" />
            <div className="flex items-center gap-3 px-3 pb-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Film title (optional)" className="!w-64 !h-9" aria-label="Film title" />
              <button onClick={() => setConcept("A young woman receives a mysterious phone call in a rainy city at midnight.")} className="text-[13px] text-faint hover:text-ink">Try an example</button>
            </div>
          </div>
        </motion.div>

        <div className="mt-10 space-y-8">
          <Row label="Genre"><Chips label="Genre" value={genre} onChange={setGenre} options={GENRES.slice(0, 8)} custom={genreC} setCustom={setGenreC} /></Row>
          <Row label="Film style"><Chips label="Style" value={style} onChange={setStyle} options={FILM_STYLES} custom={styleC} setCustom={setStyleC} /></Row>
          <Row label="Film length">
            <div className="flex flex-wrap gap-2 items-center" role="radiogroup" aria-label="Film length">
              {DURATIONS.map((d) => <button key={d.v} role="radio" aria-checked={dur === d.v} onClick={() => setDur(d.v)} className={cx("h-9 px-3.5 rounded-full border text-[13.5px] font-medium", dur === d.v ? "bg-amber text-[#1b1208] border-amber" : "border-line text-ink/85 hover:border-[#4a4e5d]")}>{d.l}</button>)}
              <button role="radio" aria-checked={dur === "custom"} onClick={() => setDur("custom")} className={cx("h-9 px-3.5 rounded-full border text-[13.5px] font-medium", dur === "custom" ? "bg-amber text-[#1b1208] border-amber" : "border-dashed border-line text-mute")}>Custom</button>
              {dur === "custom" && <span className="inline-flex items-center gap-2"><Input type="number" min={5} max={600} value={durC} onChange={(e) => setDurC(e.target.value)} className="!w-24 !h-9" aria-label="Custom length in seconds" /><span className="text-sm text-mute">seconds</span></span>}
            </div>
          </Row>
          <Row label="Number of shots">
            <div className="flex flex-wrap gap-2 items-center" role="radiogroup" aria-label="Number of shots">
              <button role="radio" aria-checked={count === "auto"} onClick={() => setCount("auto")} className={cx("h-9 px-3.5 rounded-full border text-[13.5px] font-medium", count === "auto" ? "bg-amber text-[#1b1208] border-amber" : "border-line text-ink/85 hover:border-[#4a4e5d]")}>Auto (≈{Math.max(3, Math.min(24, Math.round(duration / per)))})</button>
              {[4, 6, 8, 10, 12].map((n) => <button key={n} role="radio" aria-checked={count === n} onClick={() => setCount(n)} className={cx("h-9 w-11 rounded-full border text-[13.5px] font-medium tabular-nums", count === n ? "bg-amber text-[#1b1208] border-amber" : "border-line text-ink/85 hover:border-[#4a4e5d]")}>{n}</button>)}
              <span className="inline-flex items-center gap-2 ml-1"><Input type="number" min={1} max={40} value={typeof count === "number" ? count : ""} placeholder="Other" onChange={(e) => { const v = Math.max(1, Math.min(40, Number(e.target.value) || 0)); setCount(v ? v : "auto"); }} className="!w-24 !h-9" aria-label="Exact number of shots" /><span className="text-sm text-mute">shots</span></span>
            </div>
            <p className="text-[12.5px] text-faint mt-2">Each shot becomes one storyboard frame and one clip you generate.</p>
          </Row>
          <Row label="Aspect ratio">
            <div className="flex gap-3" role="radiogroup" aria-label="Aspect ratio">
              {ASPECTS.map((a) => {
                const [w, h] = a.split(":").map(Number), k = 34 / Math.max(w / h, h / w);
                const bw = w >= h ? 34 : 34 * (w / h), bh = w >= h ? 34 * (h / w) : 34;
                return (
                  <button key={a} role="radio" aria-checked={aspect === a} onClick={() => setAspect(a)} className={cx("w-[104px] h-[84px] rounded-xl border flex flex-col items-center justify-center gap-2 transition-colors", aspect === a ? "border-amber bg-amber-soft" : "border-line hover:border-[#4a4e5d]")}>
                    <span className={cx("rounded-[3px] border-2", aspect === a ? "border-amber" : "border-mute/60")} style={{ width: bw, height: bh }} data-k={k} />
                    <span className="text-[13px] font-semibold">{a}</span>
                  </button>
                );
              })}
            </div>
          </Row>
          <Row label="Shot complexity">
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Shot complexity">
              {([["simple", "Simple", "Fewer, longer shots. Easiest to generate."], ["balanced", "Balanced", "A natural mix of wide and close shots."], ["cinematic", "Cinematic", "More, shorter shots with richer coverage."]] as const).map(([v, l, d]) => (
                <button key={v} role="radio" aria-checked={cx_ === v} onClick={() => setCx(v)} className={cx("text-left rounded-xl border p-4 transition-colors", cx_ === v ? "border-amber bg-amber-soft" : "border-line hover:border-[#4a4e5d]")}>
                  <div className="font-semibold">{l}</div><div className="text-[13px] text-mute mt-1 leading-snug">{d}</div>
                </button>
              ))}
            </div>
          </Row>
        </div>

        <div className="mt-12 rounded-2xl border border-line bg-surface p-6">
          {ai.text ? (
            <div className="flex items-center gap-6">
              <div className="flex-1 text-[13.5px] text-mute leading-relaxed">
                <span className="inline-flex items-center gap-1.5 text-ai font-semibold"><Sparkles className="h-4 w-4" />{ai.provider} will write your film:</span> characters, locations, a consistent look, {count === "auto" ? "about " : "exactly "}{shotCount} shots with their dialogue — then make a storyboard frame for every shot. After that you take it to Higgsfield or Sora one shot at a time.
                {busy && <div className="mt-2 text-ai">Writing… {progress > 0 ? `${Math.round(progress / 1000)}k characters so far` : "planning the story"}</div>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Button tone="primary" size="lg" onClick={() => create(true)} disabled={busy}>
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Writing your film…</> : <><Sparkles className="h-4 w-4" />Write My Film<ArrowRight className="h-4 w-4" /></>}
                </Button>
                <button disabled={busy} onClick={() => create(false)} className="text-[12.5px] text-faint hover:text-ink disabled:opacity-40">or start with {shotCount} blank shots</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="flex-1 text-[13.5px] text-mute leading-relaxed">
                <span className="text-ink font-medium">AI isn't connected here,</span> so SceneCraft will set up {shotCount} blank shots ({duration} s) for you to write. To have scenes and dialogue written for you, open SceneCraft inside Claude, or add a free Gemini or Groq key on Vercel. <button className="text-amber hover:underline" onClick={() => st.setOverlay("settings")}>How</button> · or <button className="text-ai hover:underline" onClick={() => st.createSample()}>open the sample film</button>.
              </div>
              <Button tone="primary" size="lg" onClick={() => create(false)} disabled={busy}>Create My Storyboard<ArrowRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
        <div className="h-10" />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[150px_1fr] gap-6 items-start">
      <div className="pt-2 text-[13.5px] font-semibold text-ink/90">{label}</div>
      <div>{children}</div>
    </div>
  );
}
