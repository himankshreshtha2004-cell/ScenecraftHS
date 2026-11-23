import { ArrowDown, ArrowUp, Palette, Plus, Trash2 } from "lucide-react";
import { Button, Card, confirmDialog, Field, IconButton, Input, LockToggle, Pill, SectionTitle, Segmented, Select, TextArea } from "../components/ui";
import { totalDuration } from "../lib/checks";
import { fmtDur, uid } from "../lib/ids";
import { ASPECTS, FILM_STYLES, GENRES } from "../lib/options";
import type { Aspect, StyleProfile } from "../lib/types";
import { useStore } from "../store/store";

export default function Story() {
  const p = useStore((s) => s.project)!;
  const st = useStore.getState();
  const set = (fn: (d: typeof p) => void, key?: string) => st.update(fn, key);
  const sty = (k: keyof StyleProfile, v: any, key?: string) => set((d) => { (d.style as any)[k] = v; }, key);
  return (
    <div className="h-full overflow-y-auto thin-scroll">
      <div className="max-w-[1180px] mx-auto px-4 md:px-8 py-7">
        <SectionTitle eyebrow="Story" title="The film" sub="The concept, structure and overall look. Everything here feeds the shot prompts." />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 mt-7 items-start">
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <Field label="Title"><Input value={p.title} onChange={(e) => set((d) => { d.title = e.target.value; }, "title")} className="!text-[18px] !h-12 font-serif" /></Field>
              <Field label="Concept" hint="What the film is about, in a few sentences."><TextArea minRows={3} value={p.concept} onChange={(e) => set((d) => { d.concept = e.target.value; }, "concept")} /></Field>
              <Field label="Logline" hint="One sentence that sells it."><TextArea minRows={1} value={p.logline} onChange={(e) => set((d) => { d.logline = e.target.value; }, "logline")} placeholder="One voice message pulls a retired detective back into the case she left behind." /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Genre"><Select value={GENRES.includes(p.genre) ? p.genre : "__c"} onChange={(v) => v !== "__c" && set((d) => { d.genre = v; })} options={[...GENRES, ...(GENRES.includes(p.genre) ? [] : [{ value: "__c", label: p.genre }])]} /></Field>
                <Field label="Film style"><Select value={FILM_STYLES.includes(p.filmStyle) ? p.filmStyle : "__c"} onChange={(v) => v !== "__c" && set((d) => { d.filmStyle = v; })} options={[...FILM_STYLES, ...(FILM_STYLES.includes(p.filmStyle) ? [] : [{ value: "__c", label: p.filmStyle }])]} /></Field>
                <Field label="Target length (s)"><Input type="number" min={5} max={600} value={p.targetDuration} onChange={(e) => set((d) => { d.targetDuration = Math.max(5, Number(e.target.value) || 30); }, "tdur")} /></Field>
              </div>
              <Field label="Aspect ratio"><Segmented value={p.aspect} onChange={(v: Aspect) => set((d) => { d.aspect = v; })} options={ASPECTS.map((a) => ({ value: a, label: a }))} /></Field>
              <p className="text-[12.5px] text-faint">Planned runtime is {fmtDur(totalDuration(p))} of a {fmtDur(p.targetDuration)} target{totalDuration(p) > p.targetDuration * 1.15 ? " — a little long" : totalDuration(p) < p.targetDuration * 0.85 ? " — a little short" : ""}.</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div><h2 className="text-[16px] font-semibold">Scenes</h2><p className="text-[13px] text-mute mt-0.5">Group shots into scenes. Assign a shot to a scene from its inspector.</p></div>
                <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => set((d) => { d.scenes.push({ id: uid("sc_"), title: `Scene ${d.scenes.length + 1}`, summary: "" }); })}>Add scene</Button>
              </div>
              <div className="space-y-3 mt-4">
                {p.scenes.map((sc, i) => {
                  const shots = p.shots.filter((s) => s.sceneId === sc.id);
                  return (
                    <div key={sc.id} className="rounded-xl border border-line bg-bg/40 p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-[22px] w-8 text-mute">{i + 1}</span>
                        <Input value={sc.title} onChange={(e) => set((d) => { d.scenes[i].title = e.target.value; }, "sct" + sc.id)} className="!h-9 flex-1" aria-label="Scene title" />
                        <Pill>{shots.length} shots · {fmtDur(shots.reduce((a, s) => a + s.duration, 0))}</Pill>
                        <IconButton label="Move scene up" disabled={i === 0} onClick={() => set((d) => { const [x] = d.scenes.splice(i, 1); d.scenes.splice(i - 1, 0, x); reorderShotsByScene(d); })}><ArrowUp className="h-4 w-4" /></IconButton>
                        <IconButton label="Move scene down" disabled={i === p.scenes.length - 1} onClick={() => set((d) => { const [x] = d.scenes.splice(i, 1); d.scenes.splice(i + 1, 0, x); reorderShotsByScene(d); })}><ArrowDown className="h-4 w-4" /></IconButton>
                        <IconButton label="Delete scene" disabled={p.scenes.length <= 1} onClick={async () => {
                          const target = p.scenes[i === 0 ? 1 : i - 1];
                          if (shots.length && !(await confirmDialog({ title: `Delete “${sc.title}”?`, body: `Its ${shots.length} shots will move to “${target.title}”.`, ok: "Delete scene", danger: true }))) return;
                          set((d) => { d.shots.forEach((s) => { if (s.sceneId === sc.id) s.sceneId = target.id; }); d.scenes.splice(i, 1); reorderShotsByScene(d); });
                        }}><Trash2 className="h-4 w-4" /></IconButton>
                      </div>
                      <TextArea minRows={1} className="mt-2" value={sc.summary} placeholder="What happens in this scene?" onChange={(e) => set((d) => { d.scenes[i].summary = e.target.value; }, "scs" + sc.id)} aria-label="Scene summary" />
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card className="p-6 sticky top-0">
            <div className="flex items-center gap-2"><Palette className="h-4 w-4 text-amber" /><h2 className="text-[16px] font-semibold flex-1">Visual style</h2></div>
            <p className="text-[13px] text-mute mt-1">With Style Lock on, this look is written into every shot prompt. Shots can still override it — overrides are flagged.</p>
            <div className="mt-4"><LockToggle kind="Style" locked={p.style.locked} onChange={(v) => { sty("locked", v); st.toast(v ? "Style locked across all shots." : "Style unlocked.", "ok"); }} /></div>
            <div className="space-y-3.5 mt-5">
              <Field label="Visual style"><Input value={p.style.visualStyle} onChange={(e) => sty("visualStyle", e.target.value, "vs")} placeholder="Neo-noir cinematic realism" /></Field>
              <Field label="Colour palette"><TextArea minRows={2} value={p.style.palette} onChange={(e) => sty("palette", e.target.value, "pal")} placeholder="Deep navy shadows, warm amber practicals, neon accents" /></Field>
              <Field label="Camera language"><TextArea minRows={2} value={p.style.cameraLanguage} onChange={(e) => sty("cameraLanguage", e.target.value, "cam")} placeholder="Slow deliberate moves, shallow depth of field" /></Field>
              <Field label="Lighting"><Input value={p.style.lighting} onChange={(e) => sty("lighting", e.target.value, "lig")} placeholder="Motivated practical light, strong contrast" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Film grain"><Select value={p.style.grain} onChange={(v) => sty("grain", v)} options={[{ value: "none", label: "None" }, { value: "subtle", label: "Subtle" }, { value: "medium", label: "Medium" }, { value: "heavy", label: "Heavy" }]} /></Field>
                <Field label="Contrast"><Select value={p.style.contrast} onChange={(v) => sty("contrast", v)} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} /></Field>
              </div>
              <Field label="General atmosphere"><Input value={p.style.atmosphere} onChange={(e) => sty("atmosphere", e.target.value, "atm")} placeholder="Rain-soaked, quiet, melancholic" /></Field>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** keeps shots grouped in scene order after scenes are reordered or removed */
function reorderShotsByScene(d: { scenes: { id: string }[]; shots: { sceneId: string }[] }) {
  const order = new Map(d.scenes.map((s, i) => [s.id, i]));
  d.shots = d.shots.map((s, i) => ({ s, i })).sort((a, b) => (order.get(a.s.sceneId) ?? 99) - (order.get(b.s.sceneId) ?? 99) || a.i - b.i).map((x) => x.s) as any;
}
