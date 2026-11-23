import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Download, ExternalLink, Image as ImageIcon, Loader2, Mic, Upload, Wand2 } from "lucide-react";
import { useState } from "react";
import { AssetImg, Button, Card, cx, FileButton, Input, Pill, Progress, Segmented } from "../components/ui";
import { generateImage } from "../lib/ai";
import { makeFrames } from "../lib/frames";
import { blobOf, extOf, rasterize } from "../lib/assets";
import { copyText, download } from "../lib/download";
import { pad, slug } from "../lib/ids";
import { updateShot } from "../lib/ops";
import { buildImagePrompt, dialogueLines, formatPrompt, shotCharacters, shotLocation, TARGETS } from "../lib/prompt";
import type { Project, PromptTarget } from "../lib/types";
import { useStore } from "../store/store";
import { attachImage } from "./Storyboard";

async function downloadAsset(id: string, name: string) {
  const b = await blobOf(id); if (!b) return;
  if (b.type === "image/svg+xml") { const r = await rasterize(id, 1920); if (r) return download(new Blob([r.bytes as BlobPart], { type: "image/jpeg" }), `${name}.jpg`); }
  return download(b, `${name}.${extOf(b.type)}`);
}

export default function Generate() {
  const p = useStore((s) => s.project)!;
  const ai = useStore((s) => s.ai);
  const st = useStore.getState();
  const target: PromptTarget = p.ui.promptTarget ?? "higgsfield";
  const T = TARGETS.find((t) => t.value === target)!;
  const s = p.shots.find((x) => x.id === p.ui.selectedShotId) ?? p.shots[0];
  const [gen, setGen] = useState(false);
  if (!s) return <div className="p-10 text-mute">Add some shots first.</div>;
  const i = p.shots.indexOf(s);
  const done = p.shots.filter((x) => x.generated).length;
  const prompt = formatPrompt(p, s, target);
  const start = s.startFrameId ?? s.imageId;
  const chars = shotCharacters(p, s), { l } = shotLocation(p, s);
  const dl = dialogueLines(p, s);
  const go = (d: number) => { const n = p.shots[i + d]; if (n) st.setUI({ selectedShotId: n.id }); };
  const base = `SHOT_${pad(i + 1)}_${slug(s.title)}`;
  const genStart = async () => {
    setGen(true);
    try {
      const r = await generateImage({ prompt: buildImagePrompt(p, s), aspect: p.aspect });
      const a = await st.addGenerated(r.b64, r.mime, `AI image — ${s.title}`, ["storyboard", "frame"]);
      if (a) updateShot(s.id, (x) => { x.imageIds.push(a.id); x.imageId = a.id; if (!x.startFrameId) x.startFrameId = a.id; });
    } catch (e: any) { st.toast(`Image generation failed: ${e.message}`, "error"); } finally { setGen(false); }
  };

  return (
    <div className="h-full overflow-y-auto thin-scroll">
      <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-7">
        <div className="flex items-end gap-6 flex-wrap">
          <div className="flex-1 min-w-[320px]">
            <div className="text-[12px] font-semibold uppercase tracking-[.18em] text-faint">Generate</div>
            <h1 className="font-serif text-[44px] leading-[1.02] mt-2">Make it, one shot at a time</h1>
            <p className="text-[14px] text-mute mt-2 max-w-2xl">For each shot: take the start frame, copy the prompt into {T.label === "Full prompt" ? "your video tool" : T.label}, generate the clip, then tick it off. SceneCraft doesn't send anything to these tools for you.</p>
          </div>
          <div className="w-[300px]">
            <div className="flex justify-between text-[12.5px] mb-1.5"><span className="text-mute">Clips generated</span><span className="font-semibold tabular-nums">{done} / {p.shots.length}</span></div>
            <Progress value={p.shots.length ? done / p.shots.length : 0} tone={done === p.shots.length && done > 0 ? "ok" : "amber"} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-6">
          <span className="text-[13px] text-mute">Prompts for</span>
          <Segmented value={target} onChange={(v: PromptTarget) => st.setUI({ promptTarget: v })} options={TARGETS.map((t) => ({ value: t.value, label: t.label }))} />
          <span className="text-[12.5px] text-faint hidden md:inline">{T.hint}</span>
          <span className="flex-1" />
          <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={async () => {
            await copyText(p.shots.map((x, k) => `SHOT ${pad(k + 1)} — ${x.title.toUpperCase()} (${x.duration}s)\n${formatPrompt(p, x, target)}`).join("\n\n────────\n\n"));
            st.toast(`Copied all ${p.shots.length} ${T.label} prompts.`, "ok");
          }}>Copy all</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-6 mt-6 items-start">
          <nav aria-label="Shots" className="space-y-1.5 sticky top-0">
            {p.shots.map((x, k) => (
              <button key={x.id} onClick={() => st.setUI({ selectedShotId: x.id })} className={cx("w-full flex items-center gap-2.5 rounded-xl p-2 text-left border transition-colors", x.id === s.id ? "border-amber bg-white/[.04]" : "border-transparent hover:bg-white/[.03]")}>
                <AssetImg id={x.startFrameId ?? x.imageId} assets={p.assets} aspect={p.aspect} className="w-14 shrink-0 rounded-md" label={false}>{!(x.startFrameId ?? x.imageId) && <span className="absolute inset-0 grid place-items-center font-serif text-[15px] text-faint">{pad(k + 1)}</span>}</AssetImg>
                <span className="flex-1 min-w-0"><span className="block text-[12px] text-faint tabular-nums">Shot {pad(k + 1)} · {x.duration}s</span><span className="block text-[13px] font-medium truncate">{x.title}</span></span>
                {x.generated ? <CheckCircle2 className="h-4 w-4 text-ok shrink-0" /> : x.dialogue.length ? <Mic className="h-3.5 w-3.5 text-faint shrink-0" /> : null}
              </button>
            ))}
          </nav>

          <motion.div key={s.id + target} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-5 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-serif text-[30px] leading-none">{pad(i + 1)}</span>
              <h2 className="text-[20px] font-semibold flex-1 truncate">{s.title}</h2>
              <Pill>{s.duration} s</Pill><Pill>{p.aspect}</Pill>
              {s.generated && <Pill tone="ok"><Check className="h-3 w-3" />Generated</Pill>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-5">
              <Card className="p-5">
                <Step n={1} title="Start frame" sub={start ? "Upload this as the image to animate." : "Make a still first — video tools follow a start image much more closely than text alone."} />
                {start ? (
                  <>
                    <AssetImg id={start} assets={p.assets} aspect={p.aspect} className="mt-3" />
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Button size="sm" tone="primary" icon={<Download className="h-4 w-4" />} onClick={() => downloadAsset(start, `${base}_START`)}>Download start frame</Button>
                      {s.endFrameId && s.endFrameId !== start && <Button size="sm" icon={<Download className="h-4 w-4" />} onClick={() => downloadAsset(s.endFrameId!, `${base}_END`)}>End frame</Button>}
                      <FileButton size="sm" icon={<Upload className="h-4 w-4" />} onFiles={(f) => attachImage(s.id, f, "start")}>Replace</FileButton>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-line p-4">
                    <div className="text-[12.5px] text-mute flex items-center gap-1.5"><ImageIcon className="h-4 w-4" />Image prompt for the start frame</div>
                    <p className="text-[13px] text-ink/85 mt-2 leading-relaxed line-clamp-6">{buildImagePrompt(p, s)}</p>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={async () => { await copyText(buildImagePrompt(p, s)); st.toast("Image prompt copied.", "ok"); }}>Copy image prompt</Button>
                      <FileButton size="sm" icon={<Upload className="h-4 w-4" />} onFiles={(f) => attachImage(s.id, f, "start")}>Upload the frame</FileButton>
                      {ai.image && <Button size="sm" tone="ai" icon={<Wand2 className="h-4 w-4" />} onClick={() => makeFrames("photo", [s.id])}>Make a photo frame</Button>}
                      {ai.image && <Button size="sm" tone="ai" disabled={gen} icon={gen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} onClick={genStart}>{gen ? "Generating…" : "Generate it"}</Button>}
                    </div>
                  </div>
                )}
                {(chars.some(({ c }) => c.refAssetIds.length) || l?.refAssetIds.length) ? (
                  <div className="mt-4">
                    <div className="text-[12.5px] text-mute mb-2">References to add (if your tool takes them)</div>
                    <div className="flex gap-2 flex-wrap">
                      {chars.filter(({ c }) => c.refAssetIds.length).map(({ c }) => <Button key={c.id} size="sm" tone="ghost" icon={<Download className="h-4 w-4" />} onClick={() => downloadAsset(c.refAssetIds[0], `${slug(c.name)}_REF`)}>{c.name}</Button>)}
                      {l?.refAssetIds.length ? <Button size="sm" tone="ghost" icon={<Download className="h-4 w-4" />} onClick={() => downloadAsset(l.refAssetIds[0], `${slug(l.name)}_REF`)}>{l.name}</Button> : null}
                    </div>
                  </div>
                ) : null}
              </Card>

              <Card className="p-5 flex flex-col">
                <Step n={2} title={`Prompt for ${T.label}`} sub={target === "generic" ? "Includes any hand edits you made in the shot editor." : `Built from the shot, its cast, location, style${dl.length ? " and dialogue" : ""}.`} />
                <pre className="mt-3 flex-1 whitespace-pre-wrap rounded-xl bg-bg border border-line p-4 text-[13.5px] leading-[1.6] font-sans text-ink/90 max-h-[420px] overflow-y-auto thin-scroll">{prompt}</pre>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Button tone="primary" icon={<Copy className="h-4 w-4" />} onClick={async () => { await copyText(prompt); st.toast(`Prompt copied — paste it into ${T.label === "Full prompt" ? "your video tool" : T.label}.`, "ok"); }}>Copy prompt</Button>
                  <span className="text-[12px] text-faint tabular-nums">{prompt.length} characters</span>
                  {s.promptText != null && target !== "generic" && <span className="text-[12px] text-warn">You hand-edited this shot's prompt — pick “Full prompt” to use your edit.</span>}
                </div>
                {dl.length > 0 && <p className="text-[12px] text-faint mt-2">Spoken lines are in the prompt. Choose a model with audio in {T.label === "Full prompt" ? "your tool" : T.label} so the characters speak them.</p>}
              </Card>
            </div>

            <Card className="p-5">
              <Step n={3} title="Generate and tick it off" sub={`In ${T.label === "Full prompt" ? "your video tool" : T.label}: upload the start frame, paste the prompt, set ${s.duration} seconds and ${p.aspect}, then generate.`} />
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                {T.url && <a href={T.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-line text-sm font-medium hover:bg-white/[.04]"><ExternalLink className="h-4 w-4" />Open {T.label}</a>}
                <Button tone={s.generated ? "ok" : "subtle"} icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => { updateShot(s.id, (x) => { x.generated = !x.generated; }); if (!s.generated) st.toast(`Shot ${pad(i + 1)} marked as generated.`, "ok"); }}>{s.generated ? "Generated ✓" : "Mark as generated"}</Button>
                <Input value={s.resultUrl} onChange={(e) => updateShot(s.id, (x) => { x.resultUrl = e.target.value; }, "url")} placeholder="Paste the clip's link (optional)" className="!w-[320px]" aria-label="Link to the generated clip" />
                <span className="flex-1" />
                <Button tone="ghost" icon={<ArrowLeft className="h-4 w-4" />} disabled={i === 0} onClick={() => go(-1)}>Previous</Button>
                <Button tone="primary" disabled={i === p.shots.length - 1} onClick={() => go(1)}>Next shot<ArrowRight className="h-4 w-4" /></Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid place-items-center h-7 w-7 rounded-full bg-amber/15 text-amber text-[13px] font-bold shrink-0">{n}</span>
      <div><div className="text-[15px] font-semibold">{title}</div><div className="text-[12.5px] text-mute mt-0.5">{sub}</div></div>
    </div>
  );
}
export type { Project };
