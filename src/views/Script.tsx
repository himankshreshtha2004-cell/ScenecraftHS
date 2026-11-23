import { motion } from "framer-motion";
import { Download, FileText, Loader2, Pencil, Plus, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { FrameJobBar, MakeFramesButton } from "../components/FrameMaker";
import ShotInspector from "../components/ShotInspector";
import { AssetImg, Button, cx, Select, useMobile, useMobileSheet, MobileSheet, isMobileNow } from "../components/ui";
import { continueStory } from "../lib/ai";
import { shotFromProposal, storyContext } from "../lib/aiapply";
import { totalDuration } from "../lib/checks";
import { download } from "../lib/download";
import { scriptMarkdown } from "../lib/exporter";
import { fmtDur, pad, slug, uid } from "../lib/ids";
import { addShot } from "../lib/ops";
import { dialogueLines, shotLocation } from "../lib/prompt";
import { useStore } from "../store/store";
import { useEditorTab } from "./ShotEditor";

export default function Script() {
  const p = useStore((s) => s.project)!;
  const ai = useStore((s) => s.ai);
  const inspector = useStore((s) => s.prefs.inspector);
  const mobile = useMobile(); const sheet = useMobileSheet((m) => m.open);
  const st = useStore.getState();
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState("3");
  const sel = p.shots.find((s) => s.id === p.ui.selectedShotId) ?? null;
  const lines = p.shots.reduce((a, s) => a + s.dialogue.filter((d) => d.line.trim()).length, 0);

  const more = async () => {
    setBusy(true);
    try {
      const r = await continueStory(storyContext(p), Number(n));
      let first = "";
      st.update((d) => {
        const scene = { id: uid("sc_"), title: r.title || `Scene ${d.scenes.length + 1}`, summary: r.summary || "" };
        d.scenes.push(scene);
        (r.shots || []).forEach((s) => { const x = shotFromProposal(d, s, scene.id, d.shots.length + 1); d.shots.push(x); if (!first) first = x.id; });
        if (first) d.ui.selectedShotId = first;
      });
      st.toast(`Added “${r.title}” — ${r.shots?.length ?? 0} new shots.`, "info", { label: "Undo", run: () => st.undo() });
      setTimeout(() => document.getElementById("script-end")?.scrollIntoView({ behavior: "smooth", block: "end" }), 200);
    } catch (e: any) { st.toast(`Couldn't continue the story: ${e.message}`, "error"); } finally { setBusy(false); }
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-y-auto thin-scroll">
        <div className="max-w-[860px] mx-auto px-4 md:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold uppercase tracking-[.18em] text-faint">Script</div>
              <h1 className="font-serif text-[34px] md:text-[46px] leading-[1.02] mt-2">{p.title}</h1>
              {p.logline && <p className="font-serif italic text-[19px] text-ink/80 mt-2">{p.logline}</p>}
              <p className="text-[13px] text-faint mt-3">{p.scenes.length} scenes · {p.shots.length} shots · {lines} lines of dialogue · {fmtDur(totalDuration(p))}</p>
            </div>
            <div className="flex flex-row flex-wrap sm:flex-col sm:items-end gap-2 sm:pt-6">
              <Button icon={<Download className="h-4 w-4" />} onClick={() => download(new Blob([scriptMarkdown(p)], { type: "text/markdown" }), `${slug(p.title)}_SCRIPT.md`)}>Download script</Button>
              <MakeFramesButton p={p} />
              <Button tone="primary" icon={<Wand2 className="h-4 w-4" />} onClick={() => st.go("generate")}>Make the shots</Button>
            </div>
          </div>

          <div className="mt-6"><FrameJobBar /></div>
          <div className="mt-6 rounded-2xl bg-[#15161c] border border-line px-4 md:px-10 py-6 md:py-9 font-mono text-[13px] md:text-[14.5px] leading-[1.65]">
            {p.scenes.map((sc, k) => {
              const shots = p.shots.filter((s) => s.sceneId === sc.id);
              return (
                <section key={sc.id} className="mb-10 last:mb-0">
                  <div className="text-amber font-semibold tracking-wide">SCENE {k + 1} — {sc.title.toUpperCase()}</div>
                  {sc.summary && <p className="text-faint italic mt-1 font-sans text-[13.5px]">{sc.summary}</p>}
                  {shots.map((s) => {
                    const i = p.shots.indexOf(s);
                    const { l } = shotLocation(p, s);
                    const dl = dialogueLines(p, s);
                    return (
                      <motion.div key={s.id} layout onClick={() => { st.setUI({ selectedShotId: s.id }); if (isMobileNow()) useMobileSheet.setState({ open: true }); }} onDoubleClick={() => { useEditorTab.setState({ tab: "prompt" }); st.go("shot"); }}
                        className={cx("group relative mt-6 -mx-5 px-5 py-4 rounded-xl cursor-pointer border transition-colors", sel?.id === s.id ? "border-amber/60 bg-white/[.03]" : "border-transparent hover:bg-white/[.025]")}>
                        <div className="flex items-center gap-3">
                          <span className="text-ink font-semibold">SHOT {pad(i + 1)}.</span>
                          <span className="text-ink/90 uppercase">{l ? l.name : "Location TBD"} — {s.timeOfDay}</span>
                          <span className="text-faint text-[12.5px]">({s.duration}s · {s.framing.toLowerCase()} · {s.movement.toLowerCase()})</span>
                          <span className="flex-1" />
                          <button onClick={(e) => { e.stopPropagation(); st.setUI({ selectedShotId: s.id }); useEditorTab.setState({ tab: "prompt" }); st.go("shot"); }} className="opacity-0 group-hover:opacity-100 text-faint hover:text-amber font-sans text-[12px] inline-flex items-center gap-1"><Pencil className="h-3 w-3" />Open</button>
                        </div>
                        <div className="flex gap-4 mt-2">
                          <p className={cx("flex-1", s.description ? "text-ink/85" : "text-faint italic")}>{s.description || "Describe what happens in this shot."}{s.motion && <span className="text-mute"> {s.motion}</span>}</p>
                          {s.imageId && <AssetImg id={s.imageId} assets={p.assets} aspect={p.aspect} className="w-[120px] shrink-0 rounded-md opacity-90" label={false} />}
                        </div>
                        {dl.map((d, j) => (
                          <div key={j} className="mt-3 pl-[22%] pr-[14%]">
                            <div className="text-center text-ink font-semibold uppercase">{d.who}{d.vo ? " (V.O.)" : ""}</div>
                            {d.how && !d.vo && <div className="text-center text-faint">({d.how})</div>}
                            <div className="text-center text-ink/90">{d.line}</div>
                          </div>
                        ))}
                        {s.sound && <div className="mt-3 text-[12.5px] text-faint uppercase tracking-wide">SOUND: {s.sound}</div>}
                      </motion.div>
                    );
                  })}
                </section>
              );
            })}
            {!p.shots.length && <p className="text-faint font-sans">No shots yet.</p>}
            <div id="script-end" />
          </div>

          <div className="mt-6 rounded-2xl border border-line bg-surface p-5 flex items-center gap-4 flex-wrap">
            {ai.text ? (
              <>
                <Sparkles className="h-5 w-5 text-ai" />
                <div className="flex-1 min-w-[240px]"><div className="text-[14px] font-semibold">Continue the story</div><div className="text-[12.5px] text-mute">{ai.provider} writes the next scene — shots, action and dialogue — following on from the script above.</div></div>
                <Select value={n} onChange={setN} options={["2", "3", "4", "5"].map((x) => ({ value: x, label: `${x} shots` }))} className="w-[120px]" aria-label="Shots in the next scene" />
                <Button tone="ai" disabled={busy} onClick={more} icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}>{busy ? "Writing…" : "Write next scene"}</Button>
              </>
            ) : (
              <>
                <FileText className="h-5 w-5 text-faint" />
                <div className="flex-1 text-[13px] text-mute">Write each shot's action and dialogue in the panel on the right. To have scenes and dialogue written for you, connect AI — <button className="text-ai hover:underline" onClick={() => st.setOverlay("settings")}>how</button>.</div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => addShot(p.shots[p.shots.length - 1]?.id)}>Add shot</Button>
              </>
            )}
          </div>
          <div className="h-10" />
        </div>
      </div>
      {sel && mobile && sheet && <MobileSheet onClose={() => useMobileSheet.setState({ open: false })}><ShotInspector key={sel.id} shot={sel} onClose={() => useMobileSheet.setState({ open: false })} /></MobileSheet>}
      {sel && !mobile && inspector && <ShotInspector key={sel.id} shot={sel} onClose={() => st.setPrefs({ inspector: false })} />}
      {sel && !mobile && !inspector && <button onClick={() => st.setPrefs({ inspector: true })} className="w-10 shrink-0 border-l border-line text-faint hover:text-ink text-[12px] [writing-mode:vertical-rl] tracking-wider">SHOT INSPECTOR</button>}
    </div>
  );
}
