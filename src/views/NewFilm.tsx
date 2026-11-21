import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Logo } from "../components/Shell";
import { Button, cx, Input, TextArea } from "../components/ui";
import { proposeStoryboard, type ProposedBoard } from "../lib/ai";
import { uid } from "../lib/ids";
import { ASPECTS, DURATIONS, FILM_STYLES, FRAMINGS, GENRES, LIGHTINGS, MOODS, MOVEMENTS, TIMES } from "../lib/options";
import { emptyProject, newShot } from "../lib/sample";
import type { Aspect, Character, Complexity, Location, Project } from "../lib/types";
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

const pick = (list: { value: string }[] | string[], v: string | undefined, d: string) => {
  const vals = (list as any[]).map((x) => (typeof x === "string" ? x : x.value));
  if (!v) return d;
  return vals.find((x) => x.toLowerCase() === v.toLowerCase()) ?? d;
};

function fromProposal(base: Project, b: ProposedBoard): Project {
  const p = structuredClone(base);
  if (b.title) p.title = base.title && base.title !== "Untitled film" ? base.title : b.title;
  p.logline = b.logline || "";
  const chars: Character[] = (b.characters || []).slice(0, 6).map((c) => {
    const w = uid("w_");
    return { id: uid("c_"), name: c.name, role: "", description: c.description || "", face: "", hair: c.hair || "", accessories: "", wardrobes: [{ id: w, name: "Main outfit", clothes: c.clothes || "" }], lockedWardrobeId: w, refAssetIds: [], locked: false };
  });
  const locs: Location[] = (b.locations || []).slice(0, 6).map((l) => ({ id: uid("l_"), name: l.name, architecture: l.architecture || "", description: l.description || "", objects: "", materials: "", palette: "", lighting: "", variants: [], refAssetIds: [], locked: false }));
  p.characters = chars; p.locations = locs; p.scenes = []; p.shots = [];
  (b.scenes || []).forEach((sc) => {
    const scene = { id: uid("sc_"), title: sc.title || `Scene ${p.scenes.length + 1}`, summary: sc.summary || "" };
    p.scenes.push(scene);
    (sc.shots || []).forEach((s) => {
      const cs = (s.characters || []).map((n) => chars.find((c) => c.name.toLowerCase() === n.toLowerCase())).filter(Boolean) as Character[];
      const loc = locs.find((l) => l.name.toLowerCase() === (s.location || "").toLowerCase());
      p.shots.push(newShot(scene.id, p.shots.length + 1, {
        title: s.title || `Shot ${p.shots.length + 1}`, description: s.description || "", duration: Math.max(2, Math.min(20, Math.round(Number(s.duration) || 5))),
        framing: pick(FRAMINGS, s.framing, "Medium Shot"), movement: pick(MOVEMENTS, s.movement, "Static"), lighting: pick(LIGHTINGS, s.lighting, "Natural Daylight"),
        mood: pick(MOODS, s.mood, "Dramatic"), timeOfDay: pick(TIMES, s.timeOfDay, "Afternoon"), motion: s.motion || "",
        characters: cs.map((c) => ({ characterId: c.id, wardrobeId: c.lockedWardrobeId })), locationId: loc?.id ?? null,
      }));
    });
  });
  if (!p.shots.length) return base;
  p.ui.selectedShotId = p.shots[0].id;
  return p;
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
  const [busy, setBusy] = useState(false);
  const duration = dur === "custom" ? Math.max(5, Math.min(600, Number(durC) || 30)) : dur;
  const per = cx_ === "simple" ? 8 : cx_ === "balanced" ? 6 : 4;
  const shotCount = Math.max(3, Math.min(24, Math.round(duration / per)));

  async function create() {
    if (!concept.trim()) { st.toast("Describe your film first — a sentence is enough.", "error"); return; }
    const g = genre === "__custom" ? genreC.trim() || "Custom" : genre;
    const fs = style === "__custom" ? styleC.trim() || "Custom" : style;
    const base = emptyProject({ title: title.trim() || "Untitled film", concept: concept.trim(), genre: g, filmStyle: fs, aspect, targetDuration: duration, complexity: cx_ });
    if (ai.text) {
      setBusy(true);
      try {
        const b = await proposeStoryboard({ concept: concept.trim(), genre: g, filmStyle: fs, duration, complexity: cx_, aspect });
        const p = fromProposal(base, b);
        await st.createProject(p);
        st.toast(`${ai.provider || "AI"} proposed ${p.shots.length} shots. Everything is editable.`, "info");
      } catch (e: any) {
        setBusy(false);
        st.toast(`The AI storyboard didn't work (${e.message}). You can start with blank shots instead.`, "error", { label: "Use blank shots", run: () => st.createProject(base) });
      }
      return;
    }
    await st.createProject(base);
    st.toast(`Set up ${base.shots.length} blank shots for you to fill in.`, "ok");
  }

  return (
    <div className="h-full overflow-y-auto thin-scroll">
      <div className="max-w-[920px] mx-auto px-8 py-8">
        <div className="flex items-center justify-between">
          <Button tone="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => st.metas.length ? st.go("studio") : st.setScreen("welcome")}>Back</Button>
          <Logo size={26} />
          <span className="w-20" />
        </div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-serif text-[64px] leading-none text-center mt-12">What's your film about?</h1>
          <p className="text-center text-mute mt-4">Start with an idea. You'll shape every shot next.</p>
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

        <div className="mt-12 rounded-2xl border border-line bg-surface p-6 flex items-center gap-6">
          <div className="flex-1 text-[13.5px] text-mute leading-relaxed">
            {ai.text ? (
              <><span className="inline-flex items-center gap-1.5 text-ai font-semibold"><Sparkles className="h-4 w-4" />{ai.provider || "AI"} connected.</span> It will propose scenes and about {shotCount} shots from your idea. You can edit or delete anything it suggests.</>
            ) : (
              <>No AI provider is connected, so SceneCraft will set up <span className="text-ink font-medium">{shotCount} blank shots</span> ({duration} s) for you to describe. <button className="text-amber hover:underline" onClick={() => st.setOverlay("settings")}>How to connect AI</button> · or <button className="text-ai hover:underline" onClick={() => st.createSample()}>open the sample storyboard</button>.</>
            )}
          </div>
          <Button tone="primary" size="lg" onClick={create} disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Building your storyboard…</> : <>Create My Storyboard<ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
        <div className="h-10" />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-6 items-start">
      <div className="pt-2 text-[13.5px] font-semibold text-ink/90">{label}</div>
      <div>{children}</div>
    </div>
  );
}
