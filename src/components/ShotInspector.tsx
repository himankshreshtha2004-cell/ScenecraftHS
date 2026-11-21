import { ChevronLeft, ChevronRight, Copy, Info, Maximize2, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { continuityStatus, readiness, shotIssues, STATUS_LABEL } from "../lib/checks";
import { copyText } from "../lib/download";
import { pad, uid } from "../lib/ids";
import { FRAMINGS, LIGHTINGS, MOODS, MOVEMENTS, TIMES } from "../lib/options";
import { deleteShot, updateShot } from "../lib/ops";
import { promptOf } from "../lib/prompt";
import type { Project, Shot } from "../lib/types";
import { useStore } from "../store/store";
import { Button, Collapsible, confirmDialog, cx, Field, IconButton, Input, Pill, Progress, Segmented, Select, TextArea } from "./ui";

export function StatusPill({ status }: { status: Shot["status"] }) {
  return status === "approved" ? <Pill tone="ok">Approved</Pill> : status === "review" ? <Pill tone="ai">Review</Pill> : <Pill>Draft</Pill>;
}
export function ContinuityDot({ p, s, withLabel }: { p: Project; s: Shot; withLabel?: boolean }) {
  const cs = continuityStatus(shotIssues(p, s));
  const c = cs === "ready" ? "bg-ok" : cs === "review" ? "bg-warn" : "bg-bad";
  return (
    <span className="inline-flex items-center gap-1.5" title={`Continuity: ${STATUS_LABEL[cs]}`}>
      <span className={cx("h-2 w-2 rounded-full", c)} />
      {withLabel && <span className={cx("text-[12px] font-medium", cs === "ready" ? "text-ok" : cs === "review" ? "text-warn" : "text-bad")}>{cs === "ready" ? "Continuity OK" : STATUS_LABEL[cs]}</span>}
    </span>
  );
}

const optList = (l: { value: string; hint?: string }[]) => l.map((o) => ({ value: o.value, label: o.value }));

export default function ShotInspector({ shot, onClose, inEditor }: { shot: Shot; onClose?: () => void; inEditor?: boolean }) {
  const p = useStore((s) => s.project)!;
  const advanced = useStore((s) => s.prefs.advanced);
  const st = useStore.getState();
  const idx = p.shots.findIndex((x) => x.id === shot.id);
  const set = <K extends keyof Shot>(k: K, v: Shot[K], coalesce = false) => updateShot(shot.id, (s) => { s[k] = v; }, coalesce ? String(k) : undefined);
  const go = (d: number) => { const n = p.shots[idx + d]; if (n) st.setUI({ selectedShotId: n.id }); };
  const r = readiness(p, shot);
  const loc = p.locations.find((l) => l.id === shot.locationId);
  const missingChars = p.characters.filter((c) => !shot.characters.some((x) => x.characterId === c.id));
  const hint = (list: { value: string; hint?: string }[], v: string) => list.find((o) => o.value === v)?.hint;

  return (
    <aside aria-label="Shot inspector" className="w-[340px] shrink-0 border-l border-line bg-bg flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-line shrink-0">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[.14em] text-faint">Shot {pad(idx + 1)} of {pad(p.shots.length)}</div>
          <div className="text-[14.5px] font-semibold truncate">{shot.title || "Untitled shot"}</div>
        </div>
        <IconButton label="Previous shot" disabled={idx <= 0} onClick={() => go(-1)}><ChevronLeft className="h-4 w-4" /></IconButton>
        <IconButton label="Next shot" disabled={idx >= p.shots.length - 1} onClick={() => go(1)}><ChevronRight className="h-4 w-4" /></IconButton>
        {onClose && <IconButton label="Close inspector ( ] )" onClick={onClose}><X className="h-4 w-4" /></IconButton>}
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll px-4">
        <div className="py-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <Segmented size="sm" value={shot.status} onChange={(v) => set("status", v)} options={[{ value: "draft", label: "Draft" }, { value: "review", label: "Review" }, { value: "approved", label: "Approved" }]} />
            <ContinuityDot p={p} s={shot} withLabel />
          </div>
          <Field label="Shot title"><Input value={shot.title} onChange={(e) => set("title", e.target.value, true)} /></Field>
          <Field label="What happens" hint="One or two sentences about the action in this shot.">
            <TextArea minRows={3} value={shot.description} onChange={(e) => set("description", e.target.value, true)} placeholder="e.g. Elara reads the message, then looks out at the rain." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Scene">
              <Select value={shot.sceneId} onChange={(v) => {
                if (v === "__new") { const id = uid("sc_"); st.update((d) => { d.scenes.push({ id, title: `Scene ${d.scenes.length + 1}`, summary: "" }); const s = d.shots.find((x) => x.id === shot.id); if (s) s.sceneId = id; }); }
                else set("sceneId", v);
              }} options={[...p.scenes.map((s, i) => ({ value: s.id, label: `${i + 1}. ${s.title}` })), { value: "__new", label: "+ New scene" }]} />
            </Field>
            <Field label={`Duration · ${shot.duration} s`}>
              <div className="h-10 flex items-center gap-2">
                <input type="range" min={1} max={30} value={shot.duration} onChange={(e) => set("duration", Number(e.target.value), true)} className="flex-1" aria-label="Duration in seconds" />
              </div>
            </Field>
          </div>
        </div>

        <Collapsible title="Camera">
          <Field label="Framing" hint={hint(FRAMINGS, shot.framing)}><Select value={shot.framing} onChange={(v) => set("framing", v)} options={optList(FRAMINGS)} /></Field>
          <Field label="Movement" hint={hint(MOVEMENTS, shot.movement)}><Select value={shot.movement} onChange={(v) => set("movement", v)} options={optList(MOVEMENTS)} /></Field>
        </Collapsible>

        <Collapsible title="Look & feel">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Time of day"><Select value={shot.timeOfDay} onChange={(v) => set("timeOfDay", v)} options={TIMES} /></Field>
            <Field label="Mood"><Select value={MOODS.some((m) => m.value === shot.mood) ? shot.mood : "__c"} onChange={(v) => set("mood", v === "__c" ? shot.mood : v)} options={[...optList(MOODS), ...(MOODS.some((m) => m.value === shot.mood) ? [] : [{ value: "__c", label: shot.mood }])]} /></Field>
          </div>
          <Field label="Lighting"><Select value={shot.lighting} onChange={(v) => set("lighting", v)} options={optList(LIGHTINGS)} /></Field>
        </Collapsible>

        <Collapsible title="Who & where">
          <Field label="Characters">
            <div className="space-y-2">
              {shot.characters.map((sc) => {
                const c = p.characters.find((x) => x.id === sc.characterId); if (!c) return null;
                const off = c.locked && sc.wardrobeId !== c.lockedWardrobeId;
                return (
                  <div key={sc.characterId} className={cx("rounded-xl border px-3 py-2.5", off ? "border-bad/40 bg-bad-soft" : "border-line bg-surface")}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium flex-1">{c.name}</span>
                      {c.locked && <Pill tone="ok">Locked</Pill>}
                      <IconButton label={`Remove ${c.name} from shot`} className="h-7 w-7" onClick={() => updateShot(shot.id, (s) => { s.characters = s.characters.filter((x) => x.characterId !== c.id); })}><X className="h-3.5 w-3.5" /></IconButton>
                    </div>
                    {c.wardrobes.length > 0 && (
                      <Select className="mt-2" aria-label={`${c.name} wardrobe`} value={sc.wardrobeId} onChange={(v) => updateShot(shot.id, (s) => { const x = s.characters.find((y) => y.characterId === c.id); if (x) x.wardrobeId = v; })}
                        options={c.wardrobes.map((w) => ({ value: w.id, label: `${w.name}${w.id === c.lockedWardrobeId && c.locked ? " (locked)" : ""}` }))} />
                    )}
                  </div>
                );
              })}
              {missingChars.length > 0 ? (
                <Select value="" placeholder="+ Add a character" onChange={(v) => { const c = p.characters.find((x) => x.id === v); if (c) updateShot(shot.id, (s) => { s.characters.push({ characterId: c.id, wardrobeId: c.lockedWardrobeId }); }); }}
                  options={missingChars.map((c) => ({ value: c.id, label: c.name }))} aria-label="Add a character" />
              ) : p.characters.length === 0 ? (
                <button onClick={() => st.go("characters")} className="text-[13px] text-amber hover:underline inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" />Create a character</button>
              ) : null}
            </div>
          </Field>
          <Field label="Location">
            <Select value={shot.locationId ?? ""} placeholder="No location" onChange={(v) => updateShot(shot.id, (s) => { s.locationId = v || null; s.locationVariantId = null; s.architectureOverride = ""; })}
              options={p.locations.map((l) => ({ value: l.id, label: `${l.name}${l.locked ? " (locked)" : ""}` }))} />
          </Field>
          {loc && loc.variants.length > 0 && (
            <Field label="Lighting & weather variation">
              <Select value={shot.locationVariantId ?? ""} placeholder="Default" onChange={(v) => set("locationVariantId", v || null)} options={loc.variants.map((v) => ({ value: v.id, label: v.name }))} />
            </Field>
          )}
          {!p.locations.length && <button onClick={() => st.go("locations")} className="text-[13px] text-amber hover:underline inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" />Create a location</button>}
        </Collapsible>

        <Collapsible title="Motion" defaultOpen={inEditor}>
          <Field label="What moves in this shot?" hint="Describe the subject's movement and anything else in motion.">
            <TextArea minRows={3} value={shot.motion} onChange={(e) => set("motion", e.target.value, true)} placeholder="The woman slowly turns toward the glowing window while the camera pushes forward." />
          </Field>
        </Collapsible>

        <Collapsible title="Advanced" defaultOpen={advanced} icon={<SlidersHorizontal className="h-3.5 w-3.5 text-faint" />}>
          {p.style.locked ? (
            <>
              <p className="text-[12.5px] text-faint leading-relaxed flex gap-1.5"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />Style Lock is on. Anything you type here overrides the film's locked style for this shot only, and is flagged for review.</p>
              <Field label="Visual style override"><Input value={shot.styleOverride.visualStyle ?? ""} placeholder={p.style.visualStyle} onChange={(e) => updateShot(shot.id, (s) => { s.styleOverride = { ...s.styleOverride, visualStyle: e.target.value }; }, "ov-vs")} /></Field>
              <Field label="Colour palette override"><Input value={shot.styleOverride.palette ?? ""} placeholder={p.style.palette} onChange={(e) => updateShot(shot.id, (s) => { s.styleOverride = { ...s.styleOverride, palette: e.target.value }; }, "ov-pal")} /></Field>
              <Field label="Lighting style override"><Input value={shot.styleOverride.lighting ?? ""} placeholder={p.style.lighting} onChange={(e) => updateShot(shot.id, (s) => { s.styleOverride = { ...s.styleOverride, lighting: e.target.value }; }, "ov-li")} /></Field>
            </>
          ) : <p className="text-[12.5px] text-faint">Turn on Style Lock (Story → Visual style) to set per-shot style overrides.</p>}
          {loc && (
            <Field label="Architecture for this shot" hint={loc.locked ? `Leave empty to use the locked ${loc.name} description.` : undefined}>
              <TextArea minRows={2} value={shot.architectureOverride} placeholder={loc.architecture || "Same as the location"} onChange={(e) => set("architectureOverride", e.target.value, true)} />
            </Field>
          )}
          <Field label="Shot notes"><TextArea minRows={2} value={shot.notes} onChange={(e) => set("notes", e.target.value, true)} placeholder="Anything the generator or your team should know." /></Field>
        </Collapsible>
        <div className="h-4" />
      </div>

      <div className="border-t border-line p-4 space-y-3 shrink-0 bg-surface/40">
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] text-mute">Readiness</span>
          <Progress value={r.score} tone={r.ready ? "ok" : "amber"} className="flex-1" />
          <span className={cx("text-[12px] font-semibold tabular-nums", r.ready ? "text-ok" : "text-mute")}>{r.checks.filter((c) => c.ok && !c.na).length}/{r.checks.filter((c) => !c.na).length}</span>
        </div>
        <div className="flex gap-2">
          {!inEditor && <Button tone="primary" className="flex-1" icon={<Maximize2 className="h-4 w-4" />} onClick={() => { st.setUI({ selectedShotId: shot.id }); st.go("shot"); }}>Open shot editor</Button>}
          <Button tone="subtle" className={inEditor ? "flex-1" : ""} icon={<Copy className="h-4 w-4" />} onClick={async () => { await copyText(promptOf(p, shot)); st.toast("Video prompt copied.", "ok"); }}>{inEditor ? "Copy video prompt" : "Prompt"}</Button>
          {inEditor && <IconButton label="Delete shot" onClick={async () => { if (await confirmDialog({ title: `Delete “${shot.title}”?`, body: "You can undo this.", ok: "Delete", danger: true })) { deleteShot(shot.id); st.go("storyboard"); } }}><Trash2 className="h-4 w-4" /></IconButton>}
        </div>
      </div>
    </aside>
  );
}
