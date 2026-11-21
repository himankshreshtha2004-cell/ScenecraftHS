import { CheckCircle2, Copy, Download, Pencil, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ContinuityDot, StatusPill } from "../components/ShotInspector";
import { AssetImg, Button, Card, cx, Pill, SectionTitle, Segmented } from "../components/ui";
import { continuityStatus, projectIssues, readiness, shotIssues, STATUS_LABEL } from "../lib/checks";
import { copyText, download } from "../lib/download";
import { pad, slug } from "../lib/ids";
import { promptOf } from "../lib/prompt";
import { useStore } from "../store/store";
import { IssueRow, useEditorTab } from "./ShotEditor";

export default function PromptStudio() {
  const p = useStore((s) => s.project)!;
  const st = useStore.getState();
  const [filter, setFilter] = useState<"open" | "kept" | "all">("open");
  const all = projectIssues(p);
  const open = all.filter((i) => !i.acknowledged);
  const shown = filter === "open" ? open : filter === "kept" ? all.filter((i) => i.acknowledged) : all;
  const cs = continuityStatus(all);
  const allText = p.shots.map((s, i) => `SHOT ${pad(i + 1)} — ${s.title.toUpperCase()} (${s.duration}s)\n${promptOf(p, s)}`).join("\n\n");
  const counts = { ready: 0, review: 0, conflict: 0 };
  p.shots.forEach((s) => counts[continuityStatus(shotIssues(p, s))]++);

  return (
    <div className="h-full overflow-y-auto thin-scroll">
      <div className="max-w-[1240px] mx-auto px-8 py-7">
        <SectionTitle eyebrow="Prompt Studio" title="Prompts & continuity" sub="Every shot's video prompt in one place, and a continuity check that compares each shot's settings against your locked characters, locations, outfits and style."
          right={<>
            <Button icon={<Copy className="h-4 w-4" />} onClick={async () => { await copyText(allText); st.toast(`Copied ${p.shots.length} prompts.`, "ok"); }}>Copy all prompts</Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={() => download(new Blob([allText + "\n"], { type: "text/plain" }), `${slug(p.title)}_VIDEO_PROMPTS.txt`)}>Download .txt</Button>
          </>} />

        <Card className="mt-7 p-6">
          <div className="flex items-center gap-3 flex-wrap">
            <ShieldCheck className={cx("h-5 w-5", cs === "ready" ? "text-ok" : cs === "review" ? "text-warn" : "text-bad")} />
            <h2 className="text-[16px] font-semibold">Continuity checker</h2>
            <span className={cx("text-[13px] font-semibold", cs === "ready" ? "text-ok" : cs === "review" ? "text-warn" : "text-bad")}>{STATUS_LABEL[cs]}</span>
            <span className="flex-1" />
            <Pill tone="ok">{counts.ready} ready</Pill><Pill tone="warn">{counts.review} need review</Pill><Pill tone="bad">{counts.conflict} conflict</Pill>
          </div>
          <div className="flex gap-1.5 mt-4">
            {p.shots.map((s, i) => {
              const c = continuityStatus(shotIssues(p, s));
              return <button key={s.id} onClick={() => { st.setUI({ selectedShotId: s.id }); useEditorTab.setState({ tab: "check" }); st.go("shot"); }} title={`Shot ${pad(i + 1)} · ${STATUS_LABEL[c]}`}
                className={cx("flex-1 h-9 rounded-lg text-[12px] font-semibold tabular-nums border transition-colors", c === "ready" ? "bg-ok-soft border-ok/30 text-ok" : c === "review" ? "bg-warn-soft border-warn/30 text-warn" : "bg-bad-soft border-bad/30 text-bad")}>{pad(i + 1)}</button>;
            })}
          </div>
          <div className="flex items-center gap-3 mt-5">
            <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: "open", label: `Open (${open.length})` }, { value: "kept", label: `Kept as intentional (${all.length - open.length})` }, { value: "all", label: "All" }]} />
            <span className="text-[12px] text-faint">Rules check the structured data only — no image analysis is performed.</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {shown.map((i) => <IssueRow key={i.id + i.shotId} i={i} />)}
            {!shown.length && <p className="col-span-2 text-sm text-mute flex items-center gap-2 py-4"><CheckCircle2 className="h-4 w-4 text-ok" />{filter === "open" ? "No open continuity issues." : "Nothing here."}</p>}
          </div>
        </Card>

        <h2 className="text-[17px] font-semibold mt-10 mb-4">Shot prompts</h2>
        <div className="space-y-3">
          {p.shots.map((s, i) => {
            const r = readiness(p, s);
            const text = promptOf(p, s);
            return (
              <Card key={s.id} className="p-4 flex gap-4">
                <AssetImg id={s.imageId} assets={p.assets} aspect={p.aspect} className="w-[180px] shrink-0 self-start rounded-lg" label={false} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-serif text-[20px] leading-none">{pad(i + 1)}</span>
                    <span className="font-semibold">{s.title}</span>
                    <StatusPill status={s.status} />
                    <ContinuityDot p={p} s={s} withLabel />
                    {s.promptText != null && <Pill tone="amber">Edited</Pill>}
                    <span className="flex-1" />
                    <span className={cx("text-[12px] font-semibold", r.ready ? "text-ok" : "text-mute")}>{r.ready ? "Ready" : `${r.checks.filter((c) => c.ok && !c.na).length}/${r.checks.filter((c) => !c.na).length} planned`}</span>
                  </div>
                  <p className="text-[13.5px] text-mute leading-relaxed mt-2 line-clamp-3">{text}</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={async () => { await copyText(text); st.toast(`Shot ${pad(i + 1)} prompt copied.`, "ok"); }}>Copy</Button>
                    <Button size="sm" tone="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => { st.setUI({ selectedShotId: s.id }); useEditorTab.setState({ tab: "prompt" }); st.go("shot"); }}>Edit prompt</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
