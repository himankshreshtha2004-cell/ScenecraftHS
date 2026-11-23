import { Check, Info, Lightbulb } from "lucide-react";
import { Card, cx, Field, Input, Pill, SectionTitle, Segmented, Select } from "../components/ui";
import { costPerAttempt, creditTotals, generationsFor, projectIssues } from "../lib/checks";
import { pad } from "../lib/ids";
import type { CreditSettings } from "../lib/types";
import { useStore } from "../store/store";

const PRESETS: { name: string; v: Partial<CreditSettings> }[] = [
  { name: "My plan (enter your numbers)", v: {} },
  { name: "Illustrative — flat cost per clip", v: { mode: "per-attempt", credits: 70, maxClip: 10 } },
  { name: "Illustrative — cost per second", v: { mode: "per-second", credits: 8, maxClip: 10 } },
  { name: "Illustrative — premium model", v: { mode: "per-attempt", credits: 150, maxClip: 8 } },
];

const n = (x: number) => x.toLocaleString();

export default function Credits() {
  const p = useStore((s) => s.project)!;
  const st = useStore.getState();
  const c = p.credits;
  const set = (v: Partial<CreditSettings>, key?: string) => st.update((d) => { Object.assign(d.credits, v); }, key);
  const t = creditTotals(p);
  const max = Math.max(1, t.without, t.with);
  const issues = projectIssues(p).filter((i) => !i.acknowledged);
  const recs = [
    { t: "Finalize framing before generation", d: "Approve each shot's framing and camera move so you aren't discovering them through paid attempts.", done: p.shots.every((s) => s.status === "approved"), n: p.shots.filter((s) => s.status !== "approved").length, unit: "not approved yet" },
    { t: "Reuse approved character references", d: "Lock characters and give each a reference image to upload with every shot they appear in.", done: p.characters.every((x) => x.locked && x.refAssetIds.length), n: p.characters.filter((x) => !(x.locked && x.refAssetIds.length)).length, unit: "without a locked reference" },
    { t: "Avoid generating unnecessary long clips", d: `Shots longer than your ${c.maxClip} s clip length need several generations.`, done: p.shots.every((s) => s.duration <= c.maxClip), n: p.shots.filter((s) => s.duration > c.maxClip).length, unit: "longer than one clip" },
    { t: "Confirm the motion prompt", d: "Say what moves in each shot — vague motion is a common reason to regenerate.", done: p.shots.every((s) => s.motion.trim()), n: p.shots.filter((s) => !s.motion.trim()).length, unit: "without motion described" },
    { t: "Prepare start and end frames", d: "Frames give the video tool a clear start and target.", done: p.shots.every((s) => s.startFrameId && s.endFrameId), n: p.shots.filter((s) => !(s.startFrameId && s.endFrameId)).length, unit: "missing a start or end frame" },
    { t: "Resolve continuity issues before export", d: "Fix or confirm each flagged difference.", done: issues.length === 0, n: issues.length, unit: "open" },
  ];

  return (
    <div className="h-full overflow-y-auto thin-scroll">
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-7">
        <SectionTitle eyebrow="Credit Planner" title="Estimate before you generate" sub="Work out roughly how many video-generation credits this film could take, and how much planning might save. All prices are numbers you enter." />
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 mt-7 items-start">
          <Card className="p-6 space-y-4">
            <Field label="Video generation provider"><Input value={c.provider} onChange={(e) => set({ provider: e.target.value }, "prov")} placeholder="e.g. Higgsfield" /></Field>
            <Field label="Model or pricing preset">
              <Select value={c.preset} onChange={(v) => { const pr = PRESETS.find((x) => x.name === v); set({ preset: v, ...(pr?.v ?? {}), userEntered: true }); }} options={[...PRESETS.map((x) => x.name), ...(PRESETS.some((x) => x.name === c.preset) ? [] : [c.preset])]} />
            </Field>
            <Field label="How credits are charged"><Segmented value={c.mode} onChange={(v) => set({ mode: v })} options={[{ value: "per-attempt", label: "Per clip" }, { value: "per-second", label: "Per second" }]} /></Field>
            <Field label={c.mode === "per-attempt" ? "Credits per generated clip" : "Credits per second of video"}>
              <Input type="number" min={0} value={c.credits} onChange={(e) => set({ credits: Math.max(0, Number(e.target.value) || 0) }, "cr")} />
            </Field>
            <Field label={`Longest clip per generation · ${c.maxClip} s`} hint="Shots longer than this need more than one generation."><input type="range" min={3} max={30} value={c.maxClip} onChange={(e) => set({ maxClip: Number(e.target.value) }, "mc")} className="w-full" /></Field>
            <div className="h-px bg-line" />
            <Field label={`Attempts per shot without detailed planning · ${c.attemptsWithout}`}><input type="range" min={1} max={8} step={0.5} value={c.attemptsWithout} onChange={(e) => set({ attemptsWithout: Number(e.target.value) }, "aw")} className="w-full" /></Field>
            <Field label={`Attempts per shot with SceneCraft planning · ${c.attemptsWith}`}><input type="range" min={1} max={8} step={0.5} value={c.attemptsWith} onChange={(e) => set({ attemptsWith: Number(e.target.value) }, "ap")} className="w-full" /></Field>
            <p className="text-[12px] text-faint leading-relaxed flex gap-1.5"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />SceneCraft doesn't know any provider's current prices. Presets marked “Illustrative” are example numbers — replace them with your plan's real rates.</p>
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-2"><h2 className="text-[16px] font-semibold flex-1">{p.title} · {p.shots.length} shots</h2><Pill tone="warn">Hypothetical estimate</Pill></div>
              <p className="text-[13px] text-mute mt-1">{c.provider || "Your provider"} · {c.mode === "per-attempt" ? `${n(c.credits)} credits per clip` : `${n(c.credits)} credits per second`} · about {n(Math.round(t.base))} credits for one attempt at every shot</p>
              <div className="mt-6 space-y-5">
                {[["Without planning", t.without, c.attemptsWithout, "bg-[#6f7383]"], ["With planning", t.with, c.attemptsWith, "bg-amber"]].map(([l, v, a, col]) => (
                  <div key={l as string}>
                    <div className="flex items-baseline justify-between mb-2"><span className="text-[14px] font-medium">{l as string} <span className="text-faint font-normal text-[12.5px]">· {a as number} attempts per shot</span></span><span className="text-[22px] font-semibold tabular-nums">{n(v as number)} <span className="text-[13px] text-mute font-normal">credits</span></span></div>
                    <div className="h-4 rounded-full bg-white/[.05] overflow-hidden"><div className={cx("h-full rounded-full transition-[width] duration-500", col as string)} style={{ width: `${((v as number) / max) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-4 rounded-xl border border-ok/30 bg-ok-soft px-5 py-4">
                <div><div className="text-[12px] text-ok/90 font-semibold uppercase tracking-wider">Potential difference</div><div className="text-[26px] font-semibold text-ok tabular-nums leading-tight">{n(t.diff)} credits</div></div>
                <div className="text-[30px] font-semibold text-ok/80 tabular-nums ml-auto">{Math.round(t.pct * 100)}%</div>
              </div>
              <p className="text-[12.5px] text-mute mt-3">Better planning may reduce avoidable attempts, but actual generation costs and results can vary. These are adjustable planning scenarios, not promised savings.</p>
            </Card>

            <Card className="p-6">
              <h2 className="text-[16px] font-semibold flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber" />Ways to avoid wasted attempts</h2>
              <ul className="mt-4 space-y-3">
                {recs.map((r) => (
                  <li key={r.t} className="flex gap-3">
                    <span className={cx("grid place-items-center h-6 w-6 rounded-full shrink-0 mt-0.5", r.done ? "bg-ok/20 text-ok" : "bg-white/[.06] text-faint")}>{r.done ? <Check className="h-3.5 w-3.5" /> : <span className="text-[11px] font-bold">{r.n}</span>}</span>
                    <div><div className="text-[14px] font-medium">{r.t}</div><div className="text-[12.5px] text-faint">{r.done ? "Done." : `${r.n} ${r.t.includes("character") ? (r.n === 1 ? "character" : "characters") : r.t.includes("continuity") ? (r.n === 1 ? "issue" : "issues") : r.n === 1 ? "shot" : "shots"} ${r.unit}. `}{!r.done && r.d}</div></div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-faint text-left"><tr className="border-b border-line">{["Shot", "Length", "Generations", "Per attempt", "With planning"].map((h) => <th key={h} className="font-medium px-4 py-3">{h}</th>)}</tr></thead>
                <tbody>
                  {p.shots.map((s, i) => (
                    <tr key={s.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2.5"><span className="tabular-nums text-faint mr-2">{pad(i + 1)}</span>{s.title}</td>
                      <td className="px-4 py-2.5 tabular-nums">{s.duration} s</td>
                      <td className={cx("px-4 py-2.5 tabular-nums", generationsFor(p, s) > 1 && "text-warn")}>{generationsFor(p, s)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{n(costPerAttempt(p, s))}</td>
                      <td className="px-4 py-2.5 tabular-nums">{n(Math.round(costPerAttempt(p, s) * c.attemptsWith))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
