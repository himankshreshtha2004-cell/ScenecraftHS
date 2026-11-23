import { motion } from "framer-motion";
import { ArrowLeft, Check, CheckCircle2, CircleAlert, Download, FileJson, FileSpreadsheet, FileText, FolderTree, Loader2, PackageCheck } from "lucide-react";
import { useState } from "react";
import { AssetImg, Button, Card, cx, Pill, Switch } from "../components/ui";
import { creditTotals, projectIssues, readiness, totalDuration } from "../lib/checks";
import { download } from "../lib/download";
import { buildKit, defaultKit, projectNotes, shotListCSV, storyboardPDF, type KitOptions } from "../lib/exporter";
import { fmtLong, slug } from "../lib/ids";
import { useStore } from "../store/store";

export default function Export() {
  const p = useStore((s) => s.project)!;
  const st = useStore.getState();
  const [o, setO] = useState<KitOptions>(defaultKit());
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string[] | null>(null);
  const shots = o.approvedOnly ? p.shots.filter((s) => s.status === "approved") : p.shots;
  const approved = p.shots.filter((s) => s.status === "approved").length;
  const ready = p.shots.filter((s) => readiness(p, s).ready).length;
  const open = projectIssues(p).filter((i) => !i.acknowledged);
  const refs = new Set<string>();
  shots.forEach((s) => [s.imageId, s.startFrameId, s.endFrameId].forEach((x) => x && refs.add(x)));
  p.characters.forEach((c) => c.refAssetIds.forEach((x) => refs.add(x)));
  p.locations.forEach((l) => l.refAssetIds.forEach((x) => refs.add(x)));
  const allGood = approved === p.shots.length && open.length === 0 && p.shots.length > 0;
  const cover = p.coverAssetId ?? p.shots.find((s) => s.imageId)?.imageId;
  const t = creditTotals(p);

  const run = async () => {
    setBusy("Starting"); setDone(null);
    try {
      const r = await buildKit(p, o, (s) => setBusy(s));
      await download(r.blob, r.name);
      setDone(r.files);
      st.toast(`Production kit downloaded — ${r.files.length} files.`, "ok");
    } catch (e: any) { st.toast(`Export failed: ${e?.message || e}`, "error"); } finally { setBusy(null); }
  };
  const one = async (label: string, fn: () => Promise<[Blob, string]>) => { setBusy(label); try { const [b, n] = await fn(); await download(b, n); } catch (e: any) { st.toast(`Export failed: ${e?.message || e}`, "error"); } finally { setBusy(null); } };
  const items: [keyof KitOptions, string, string][] = [
    ["script", "Script with dialogue", `${p.scenes.length} scenes, ${p.shots.reduce((a, s) => a + s.dialogue.length, 0)} lines, as SCRIPT.md`],
    ["images", "Storyboard images", `${shots.filter((s) => s.imageId).length} images, named by scene and shot`],
    ["prompts", "Video generation prompts", `${shots.length} files — Higgsfield, Sora and full versions`],
    ["characters", "Character references", `${p.characters.length} characters with specs and images`],
    ["locations", "Location references", `${p.locations.length} locations with descriptions and images`],
    ["frames", "Start and end frames", `${shots.filter((s) => s.startFrameId || s.endFrameId).length} shots with planned frames`],
    ["shotList", "Shot list (CSV)", "Scene, shot, duration, camera, cast, location, status"],
    ["pdf", "Storyboard PDF", "Printable boards with images, descriptions and settings"],
    ["notes", "Production notes", "Style, continuity rules, motion and a how-to"],
  ];

  return (
    <div className="h-full overflow-y-auto thin-scroll">
      <div className="max-w-[1180px] mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 items-stretch">
          <div className="relative rounded-3xl overflow-hidden min-h-[360px] border border-line">
            <AssetImg id={cover} assets={p.assets} className="absolute inset-0 !rounded-none" rounded="rounded-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
            <div className="absolute left-7 right-7 bottom-6">
              <div className="text-[12px] font-semibold uppercase tracking-[.2em] text-amber">Export production kit</div>
              <h1 className="font-serif text-[48px] leading-[1.02] mt-2">{allGood ? "Your film is ready for production." : "Almost ready for production."}</h1>
              <p className="text-mute mt-2">{p.title} · {p.genre} · {p.aspect}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Big v={`${approved}/${p.shots.length}`} l="shots approved" ok={approved === p.shots.length} />
            <Big v={fmtLong(totalDuration(p))} l="approximate duration" />
            <Big v={String(shots.length)} l="video prompts" />
            <Big v={String(refs.size)} l="reference images" />
            <Big v={t.with.toLocaleString()} l={`est. credits (with planning)`} sub="your hypothetical numbers" />
            <Big v={String(open.length)} l="unresolved continuity issues" ok={open.length === 0} bad={open.length > 0} />
          </div>
        </div>

        {!allGood && (
          <div className="mt-6 rounded-2xl border border-warn/30 bg-warn-soft p-4 flex items-start gap-3">
            <CircleAlert className="h-5 w-5 text-warn shrink-0 mt-0.5" />
            <div className="text-[13.5px] text-mute flex-1">
              You can export now — the kit always reflects what's saved. Before generating, consider:
              {approved < p.shots.length && <> approving the remaining {p.shots.length - approved} shots;</>}
              {open.length > 0 && <> resolving {open.length} continuity {open.length === 1 ? "issue" : "issues"};</>}
              {ready < p.shots.length && <> {p.shots.length - ready} shots still have planning gaps.</>}
            </div>
            <Button size="sm" tone="ghost" onClick={() => st.go(open.length ? "prompts" : "storyboard")}>Review</Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mt-6 items-start">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">What's in the kit</h2>
              <label className="flex items-center gap-2.5 text-[13px] text-mute">Approved shots only <Switch label="Approved shots only" checked={o.approvedOnly} onChange={(v) => setO({ ...o, approvedOnly: v })} /></label>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              {items.map(([k, l, d]) => (
                <button key={k} role="checkbox" aria-checked={o[k] as boolean} onClick={() => setO({ ...o, [k]: !o[k] })} className={cx("flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors", o[k] ? "border-amber/45 bg-white/[.03]" : "border-line opacity-70 hover:opacity-100 hover:border-[#4a4e5d]")}>
                  <span className={cx("grid place-items-center h-5 w-5 rounded-md border shrink-0 mt-0.5", o[k] ? "bg-amber border-amber text-[#1b1208]" : "border-line")}>{o[k] && <Check className="h-3.5 w-3.5" />}</span>
                  <span><span className="block text-[14px] font-medium">{l}</span><span className="block text-[12.5px] text-faint mt-0.5">{d}</span></span>
                </button>
              ))}
            </div>
            {o.approvedOnly && approved === 0 && <p className="text-[12.5px] text-warn mt-3">No shots are approved yet, so the kit would have no shots.</p>}
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <Button tone="primary" size="lg" disabled={!!busy || (o.approvedOnly && approved === 0)} onClick={run} icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}>{busy ? `${busy}…` : "Download Production Kit"}</Button>
              <Button tone="ghost" size="lg" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => st.go("storyboard")}>Return to Storyboard</Button>
            </div>
            <p className="text-[12.5px] text-faint mt-3">A .zip with organised folders. Uploaded images keep their original quality; sample illustrations are converted to JPG.</p>
            {done && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border border-ok/35 bg-ok-soft p-5">
                <div className="flex items-center gap-2 text-ok font-semibold"><PackageCheck className="h-5 w-5" />Production kit downloaded</div>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] font-mono text-mute max-h-56 overflow-y-auto thin-scroll">
                  <div className="col-span-2 text-ink flex items-center gap-1.5"><FolderTree className="h-3.5 w-3.5" />SCENECRAFT_{slug(p.title)}/</div>
                  {summarise(done).map((l) => <div key={l} className="truncate">{l}</div>)}
                </div>
              </motion.div>
            )}
          </Card>

          <div className="space-y-5">
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold">Export one file</h3>
              <div className="mt-3 space-y-2">
                <Row icon={<FileSpreadsheet className="h-4 w-4" />} l="Shot list (CSV)" onClick={() => one("Shot list", async () => [new Blob(["﻿" + shotListCSV(p)], { type: "text/csv" }), `${slug(p.title)}_SHOT_LIST.csv`])} />
                <Row icon={<FileText className="h-4 w-4" />} l="Storyboard PDF" onClick={() => one("PDF", async () => [await storyboardPDF(p, shots), `${slug(p.title)}_STORYBOARD.pdf`])} />
                <Row icon={<FileText className="h-4 w-4" />} l="Production notes (.md)" onClick={() => one("Notes", async () => [new Blob([projectNotes(p)], { type: "text/markdown" }), `${slug(p.title)}_PROJECT_NOTES.md`])} />
                <Row icon={<FileJson className="h-4 w-4" />} l="Project backup (re-importable)" onClick={() => one("Backup", async () => [await st.backupBlob(p.id), `${slug(p.title)}.scenecraft.json`])} />
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold">Taking it to Higgsfield</h3>
              <p className="text-[12.5px] text-faint mt-1">SceneCraft doesn't generate video or connect to Higgsfield directly. For each shot:</p>
              <ol className="mt-3 space-y-2 text-[13px] text-mute list-decimal list-inside">
                <li>Copy the prompt from <span className="font-mono text-[12px] text-ink/80">VIDEO_PROMPTS/</span>.</li>
                <li>Upload its start frame (and end frame, if the tool supports one).</li>
                <li>Add the character and location references listed in the prompt file.</li>
                <li>Match the clip length and aspect ratio, then generate.</li>
              </ol>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function summarise(files: string[]) {
  const dirs = new Map<string, number>(), top: string[] = [];
  files.forEach((f) => { const i = f.indexOf("/"); if (i < 0) top.push(f); else dirs.set(f.slice(0, i + 1), (dirs.get(f.slice(0, i + 1)) || 0) + 1); });
  return [...[...dirs].map(([d, n]) => `  ${d}  (${n})`), ...top.map((t) => `  ${t}`)];
}

function Big({ v, l, sub, ok, bad }: { v: string; l: string; sub?: string; ok?: boolean; bad?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 flex flex-col justify-end">
      <div className={cx("text-[30px] font-semibold tabular-nums leading-none flex items-center gap-2", ok && "text-ok", bad && "text-bad")}>{v}{ok && <CheckCircle2 className="h-5 w-5" />}</div>
      <div className="text-[13px] text-mute mt-2">{l}</div>
      {sub && <Pill tone="warn" className="mt-2 self-start">{sub}</Pill>}
    </div>
  );
}
function Row({ icon, l, onClick }: { icon: React.ReactNode; l: string; onClick: () => void }) {
  return <button onClick={onClick} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl border border-line hover:border-[#4a4e5d] hover:bg-white/[.02] text-[13.5px] text-left"><span className="text-mute">{icon}</span><span className="flex-1">{l}</span><Download className="h-4 w-4 text-faint" /></button>;
}
