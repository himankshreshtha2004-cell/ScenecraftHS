import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { horizontalListSortingStrategy, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clapperboard, Clock, Copy, Film, GripVertical, ImagePlus, LayoutGrid, Maximize2, MoreHorizontal, Move, Plus, Rows3, Trash2, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FrameJobBar, MakeFramesButton } from "../components/FrameMaker";
import ShotInspector, { ContinuityDot, StatusPill } from "../components/ShotInspector";
import { askText, AssetImg, Button, confirmDialog, cx, DropSlot, IconButton, Menu, Pill, Progress, Segmented, useMobile, useMobileSheet, MobileSheet, isMobileNow } from "../components/ui";
import { continuityStatus, projectIssues, projectReadiness, readiness, STATUS_LABEL, totalDuration } from "../lib/checks";
import { fmtDur, fmtLong, pad } from "../lib/ids";
import { aspectRatio } from "../lib/options";
import { frameModes, makeFrames, useFrameJob } from "../lib/frames";
import { addShot, deleteShot, duplicateShot, moveShot, setStatus, updateShot } from "../lib/ops";
import { dialogueLines } from "../lib/prompt";
import type { Project, Shot } from "../lib/types";
import { useStore } from "../store/store";

export async function attachImage(shotId: string, files: FileList | File[], as: "board" | "start" | "end" = "board") {
  const st = useStore.getState();
  const added = await st.addImages(files, [as === "board" ? "storyboard" : "frame"]);
  if (!added.length) return;
  updateShot(shotId, (s) => {
    if (as === "board") { s.imageIds.push(...added.map((a) => a.id)); s.imageId = added[added.length - 1].id; }
    if (as === "start") { s.startFrameId = added[0].id; s.startFromShotId = null; }
    if (as === "end") s.endFrameId = added[0].id;
  });
  st.toast(as === "board" ? `Added ${added.length > 1 ? `${added.length} images` : "image"} to the shot.` : `${as === "start" ? "Start" : "End"} frame saved.`, "ok");
}

function ShotCard({ p, s, i, selected, overlay }: { p: Project; s: Shot; i: number; selected: boolean; overlay?: boolean }) {
  const st = useStore.getState();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const r = readiness(p, s);
  const job = useFrameJob();
  const modes = frameModes();
  const pending = !s.imageId;
  const firstLine = dialogueLines(p, s)[0];
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} role="button" tabIndex={0} aria-label={`Shot ${i + 1}: ${s.title}`} aria-pressed={selected}
      onClick={() => { st.setUI({ selectedShotId: s.id }); if (isMobileNow()) useMobileSheet.setState({ open: true }); }}
      onDoubleClick={() => { st.setUI({ selectedShotId: s.id }); st.go("shot"); }}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) { e.preventDefault(); st.setUI({ selectedShotId: s.id }); st.go("shot"); } }}
      onFocus={(e) => { if (e.target === e.currentTarget) st.setUI({ selectedShotId: s.id }); }}
      className={cx("group relative rounded-2xl bg-surface border p-2.5 pb-3 outline-none transition-[border,box-shadow,transform,opacity] duration-200 cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-amber/60",
        selected ? "border-amber shadow-[0_0_0_1px_#E8AF79,0_16px_40px_-20px_rgba(232,175,121,.45)]" : "border-line hover:border-[#4a4e5d] hover:-translate-y-0.5",
        isDragging && !overlay && "opacity-30", overlay && "shadow-pop rotate-[1.5deg] scale-[1.02] cursor-grabbing")}>
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="font-serif text-[22px] leading-none text-ink/90 tabular-nums">{pad(i + 1)}</span>
        <ContinuityDot p={p} s={s} />
        <span className="flex-1" />
        <StatusPill status={s.status} />
        <Menu trigger={(_, t) => <IconButton label="Shot actions" className="h-7 w-7 -mr-1" onClick={t}><MoreHorizontal className="h-4 w-4" /></IconButton>} items={[
          { label: "Open shot editor", icon: <Maximize2 className="h-4 w-4" />, onClick: () => { st.setUI({ selectedShotId: s.id }); st.go("shot"); } },
          { label: s.status === "approved" ? "Mark as draft" : "Approve shot", icon: <CheckCircle2 className="h-4 w-4" />, onClick: () => setStatus(s.id, s.status === "approved" ? "draft" : "approved") },
          { label: "Duplicate", icon: <Copy className="h-4 w-4" />, onClick: () => duplicateShot(s.id) },
          { label: "Add shot after", icon: <Plus className="h-4 w-4" />, onClick: () => addShot(s.id) },
          "sep",
          { label: "Delete shot", icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => deleteShot(s.id) },
        ]} />
      </div>
      {s.imageId ? (
        <AssetImg id={s.imageId} assets={p.assets} aspect={p.aspect} className="rounded-xl">
          <div className="absolute right-2 bottom-2 rounded-md bg-black/60 backdrop-blur px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums">{fmtDur(s.duration)}</div>
          {s.imageIds.length > 1 && <div className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-semibold">{s.imageIds.length} versions</div>}
        </AssetImg>
      ) : (
        <div onPointerDown={(e) => e.stopPropagation()} className="relative">
          {job.running && job.mode && pending ? (
            <div className="rounded-xl skeleton grid place-items-center" style={{ aspectRatio: String(aspectRatio(p.aspect)) }}><span className="text-[12px] text-mute">Drawing…</span></div>
          ) : (
            <>
              <DropSlot aspect={p.aspect} onFiles={(f) => attachImage(s.id, f)} label="Add a storyboard image" sub="Drop or click to upload" />
              {modes.length > 0 && <button onClick={() => makeFrames(modes[0], [s.id])} className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-lg bg-ai/20 hover:bg-ai/30 text-ai text-[11.5px] font-semibold px-2 py-1"><Wand2 className="h-3 w-3" />Make frame</button>}
            </>
          )}
        </div>
      )}
      <div className="px-1 pt-3">
        <div className="text-[15px] font-semibold leading-tight truncate">{s.title || "Untitled shot"}</div>
        <p className={cx("text-[13px] leading-snug mt-1 line-clamp-2 min-h-[34px]", s.description ? "text-mute" : "text-faint italic")}>{s.description || "No description yet."}</p>
        {firstLine && <p className="text-[12.5px] leading-snug mt-1.5 line-clamp-2 text-ink/85"><span className="font-semibold uppercase text-[11px] tracking-wide text-amber/90">{firstLine.who}{firstLine.vo ? " (V.O.)" : ""}</span> “{firstLine.line}”{s.dialogue.length > 1 && <span className="text-faint"> +{s.dialogue.length - 1}</span>}</p>}
        <div className="flex items-center gap-1.5 mt-2.5 text-[12px] text-mute flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-md bg-white/[.05] px-1.5 h-6"><Film className="h-3 w-3" />{s.framing}</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-white/[.05] px-1.5 h-6"><Move className="h-3 w-3" />{s.movement}</span>
          {!s.imageId && <span className="inline-flex items-center gap-1 rounded-md bg-white/[.05] px-1.5 h-6 tabular-nums"><Clock className="h-3 w-3" />{s.duration}s</span>}
          <span className="ml-auto text-[11.5px] tabular-nums" title="Readiness checklist">{r.checks.filter((c) => c.ok && !c.na).length}/{r.checks.filter((c) => !c.na).length}</span>
        </div>
      </div>
    </div>
  );
}

function TimelineBlock({ p, s, i, selected, pxs }: { p: Project; s: Shot; i: number; selected: boolean; pxs: number }) {
  const st = useStore.getState();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const drag = useRef<{ x: number; d: number } | null>(null);
  const w = Math.max(84, s.duration * pxs);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, width: w }} className={cx("relative shrink-0 h-full", isDragging && "opacity-40 z-10")}>
      <div {...attributes} {...listeners} role="button" tabIndex={0} aria-label={`Shot ${i + 1}: ${s.title}, ${s.duration} seconds`}
        onClick={() => { st.setUI({ selectedShotId: s.id }); if (isMobileNow()) useMobileSheet.setState({ open: true }); }} onDoubleClick={() => st.go("shot")}
        className={cx("h-full rounded-xl border overflow-hidden bg-surface flex flex-col cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-amber/60", selected ? "border-amber ring-1 ring-amber" : "border-line hover:border-[#4a4e5d]")}>
        <AssetImg id={s.imageId} assets={p.assets} className="flex-1 min-h-0" rounded="rounded-none" label={false}>
          {!s.imageId && <div className="absolute inset-0 grid place-items-center text-faint"><ImagePlus className="h-5 w-5" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute left-2 top-2 font-serif text-[18px] leading-none drop-shadow">{pad(i + 1)}</div>
        </AssetImg>
        <div className="px-2.5 py-2 shrink-0">
          <div className="text-[12.5px] font-semibold truncate">{s.title}</div>
          <div className="text-[11.5px] text-mute flex items-center gap-1.5 tabular-nums">{s.duration}s · {s.movement}<span className="ml-auto"><ContinuityDot p={p} s={s} /></span></div>
        </div>
      </div>
      {/* drag the right edge to change duration */}
      <div role="slider" aria-label={`Duration of shot ${i + 1}`} aria-valuenow={s.duration} aria-valuemin={1} aria-valuemax={30} tabIndex={0}
        onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); updateShot(s.id, (x) => { x.duration = Math.max(1, Math.min(30, x.duration + (e.key === "ArrowRight" ? 1 : -1))); }, "dur"); } }}
        onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, d: s.duration }; }}
        onPointerMove={(e) => { if (!drag.current) return; const nd = Math.max(1, Math.min(30, Math.round(drag.current.d + (e.clientX - drag.current.x) / pxs))); if (nd !== s.duration) updateShot(s.id, (x) => { x.duration = nd; }, "dur"); }}
        onPointerUp={() => (drag.current = null)}
        className="absolute -right-1.5 top-3 bottom-3 w-3 cursor-ew-resize group/h z-10 grid place-items-center" title="Drag to change the duration">
        <span className="h-10 w-1 rounded-full bg-line group-hover/h:bg-amber group-focus/h:bg-amber transition-colors" />
      </div>
    </div>
  );
}

export default function Storyboard() {
  const p = useStore((s) => s.project)!;
  const inspector = useStore((s) => s.prefs.inspector);
  const mobile = useMobile(); const sheet = useMobileSheet((m) => m.open);
  const st = useStore.getState();
  const sel = p.ui.selectedShotId;
  const selShot = p.shots.find((s) => s.id === sel) ?? null;
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }));
  const dur = totalDuration(p);
  const ready = projectReadiness(p);
  const approved = p.shots.filter((s) => s.status === "approved").length;
  const issues = projectIssues(p).filter((i) => !i.acknowledged);
  const cs = continuityStatus(issues);
  const ar = aspectRatio(p.aspect);
  const minCol = ar >= 2 ? 300 : ar >= 1.5 ? 250 : ar >= 1 ? 220 : 190;

  const onEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (e.over && e.active.id !== e.over.id) { moveShot(String(e.active.id), String(e.over.id)); st.toast("Shot order updated.", "ok"); }
  };

  // keyboard: arrows to move between shots, Enter to open, N/D/A/Delete
  useEffect(() => {
    const k = async (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,[contenteditable=true],[role=dialog],[role=menu]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = p.shots.findIndex((s) => s.id === sel);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (t.getAttribute("role") === "slider") return;
        const n = p.shots[Math.max(0, Math.min(p.shots.length - 1, (i < 0 ? 0 : i) + (e.key === "ArrowRight" ? 1 : -1)))];
        if (n) { e.preventDefault(); st.setUI({ selectedShotId: n.id }); document.querySelector<HTMLElement>(`[aria-label^="Shot ${p.shots.indexOf(n) + 1}:"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }); }
      } else if (e.key === "Enter" && sel && t.getAttribute("role") !== "button") { st.go("shot"); }
      else if (e.key.toLowerCase() === "n") { e.preventDefault(); addShot(sel); }
      else if (e.key.toLowerCase() === "d" && sel) duplicateShot(sel);
      else if (e.key.toLowerCase() === "a" && selShot) setStatus(selShot.id, selShot.status === "approved" ? "draft" : "approved");
      else if ((e.key === "Delete" || e.key === "Backspace") && selShot) {
        if (await confirmDialog({ title: `Delete “${selShot.title}”?`, body: "You can undo this with Ctrl+Z.", ok: "Delete shot", danger: true })) deleteShot(selShot.id);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [p, sel, selShot]);

  // group consecutive shots by scene for the headers
  const groups: { sceneId: string; items: { s: Shot; i: number }[] }[] = [];
  p.shots.forEach((s, i) => {
    const g = groups[groups.length - 1];
    if (g && g.sceneId === s.sceneId) g.items.push({ s, i }); else groups.push({ sceneId: s.sceneId, items: [{ s, i }] });
  });
  const sceneName = (id: string) => { const k = p.scenes.findIndex((x) => x.id === id); return k < 0 ? "Unassigned" : `Scene ${k + 1} · ${p.scenes[k].title}`; };
  const pxs = 34;
  const dragShot = p.shots.find((s) => s.id === dragId);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-y-auto thin-scroll" onClick={(e) => { if (e.target === e.currentTarget) st.setUI({ selectedShotId: null }); }}>
        <div className="max-w-[1500px] mx-auto px-4 md:px-8 py-5 md:py-7">
          {/* header */}
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-stretch">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap whitespace-nowrap text-[11.5px] font-semibold uppercase tracking-[.14em] text-faint">
                <span>{p.genre}</span><span>·</span><span>{p.filmStyle}</span><span>·</span><span>{p.aspect}</span>
                {p.isSample && <Pill tone="ai" className="ml-1 normal-case tracking-normal">Sample project</Pill>}
              </div>
              <h1 className="mt-2"><button title="Rename film" onClick={async () => { const t = await askText({ title: "Rename film", value: p.title }); if (t != null) st.renameProject(p.id, t); }} className="font-serif text-[34px] md:text-[34px] md:text-[46px] leading-[1.02] text-left hover:text-amber/95 transition-colors">{p.title}</button></h1>
              <p className="text-[14.5px] text-mute mt-2 max-w-3xl leading-relaxed line-clamp-2">{p.concept || <button className="text-amber" onClick={() => st.go("story")}>Add a concept in Story →</button>}</p>
            </div>
            <div className="w-full lg:w-[300px] shrink-0 rounded-2xl bg-surface border border-line p-4 flex flex-col justify-between">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat v={String(p.scenes.length)} l={p.scenes.length === 1 ? "scene" : "scenes"} />
                <Stat v={String(p.shots.length)} l="shots" />
                <Stat v={fmtDur(dur)} l="runtime" />
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[12px] mb-1.5"><span className="text-mute">Planning progress</span><span className="font-semibold tabular-nums">{Math.round(ready * 100)}%</span></div>
                <Progress value={ready} tone={ready === 1 ? "ok" : "amber"} />
                <div className="flex justify-between text-[12px] mt-2 text-faint">
                  <span>{approved}/{p.shots.length} approved</span>
                  <button onClick={() => st.go("prompts")} className={cx("inline-flex items-center gap-1 font-medium hover:underline", cs === "ready" ? "text-ok" : cs === "review" ? "text-warn" : "text-bad")}>
                    {cs !== "ready" && <AlertTriangle className="h-3 w-3" />}{cs === "ready" ? "Continuity OK" : `${issues.length} continuity ${issues.length === 1 ? "issue" : "issues"}`}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-6 md:mt-8 mb-5">
            <h2 className="text-[17px] font-semibold">Storyboard</h2>
            <span className="text-sm text-faint">{p.shots.length} shots · {fmtLong(dur)}</span>
            <span className="flex-1 basis-full md:basis-auto h-0" />
            <Segmented value={p.ui.boardMode} onChange={(v) => st.setUI({ boardMode: v })} options={[{ value: "storyboard", label: <><LayoutGrid className="h-4 w-4" />Storyboard</> }, { value: "timeline", label: <><Rows3 className="h-4 w-4" />Timeline</> }]} />
            <MakeFramesButton p={p} />
            <Button tone="primary" icon={<Plus className="h-4 w-4" />} onClick={() => addShot(sel)} title="Add shot (N)">Add shot</Button>
          </div>
          <div className="mb-5"><FrameJobBar /></div>

          {p.shots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line py-16 text-center">
              <Clapperboard className="h-8 w-8 text-faint mx-auto" />
              <p className="mt-3 text-mute">No shots yet.</p>
              <Button tone="primary" className="mt-4" icon={<Plus className="h-4 w-4" />} onClick={() => addShot(null)}>Add the first shot</Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setDragId(null)}>
              {p.ui.boardMode === "storyboard" ? (
                <SortableContext items={p.shots.map((s) => s.id)} strategy={rectSortingStrategy}>
                  {/* one continuous grid, so short scenes don't leave rows half empty; each scene is marked above its first shot */}
                  <div className="grid gap-x-4 gap-y-5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))` }}>
                    {groups.flatMap((g, gi) => g.items.map(({ s: sh, i }, k) => (
                      <div key={sh.id} className="min-w-0">
                        <div className="h-6 mb-1.5 flex items-center gap-2 min-w-0">
                          {k === 0 ? (
                            <>
                              <span className="h-3.5 w-1 rounded-full bg-amber shrink-0" />
                              <span className="text-[12px] font-semibold text-ink/85 truncate" title={sceneName(g.sceneId)}>{sceneName(g.sceneId)}</span>
                              <span className="h-px flex-1 bg-line" />
                              <span className="text-[11.5px] text-faint tabular-nums shrink-0">{g.items.length} {g.items.length === 1 ? "shot" : "shots"} · {fmtDur(g.items.reduce((a, x) => a + x.s.duration, 0))}</span>
                            </>
                          ) : <span className="h-px flex-1 bg-line/60" title={sceneName(g.sceneId)} />}
                        </div>
                        <ShotCard p={p} s={sh} i={i} selected={sh.id === sel} />
                      </div>
                    )))}
                  </div>
                </SortableContext>
              ) : (
                <SortableContext items={p.shots.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
                  <div className="rounded-2xl bg-surface border border-line p-4">
                    <div className="overflow-x-auto thin-scroll pb-2">
                      <div style={{ width: Math.max(...[0]) + p.shots.reduce((a, s) => a + Math.max(84, s.duration * pxs) + 8, 0) }}>
                        <div className="flex gap-2 mb-2">
                          {groups.map((g, gi) => (
                            <div key={gi} className="shrink-0 h-6 rounded-md bg-white/[.04] text-[11.5px] text-mute px-2 flex items-center truncate" style={{ width: g.items.reduce((a, x) => a + Math.max(84, x.s.duration * pxs) + 8, -8) }}>{sceneName(g.sceneId)}</div>
                          ))}
                        </div>
                        <div className="flex gap-2 h-[190px]">
                          {p.shots.map((s, i) => <TimelineBlock key={s.id} p={p} s={s} i={i} selected={s.id === sel} pxs={pxs} />)}
                        </div>
                        <Ruler shots={p.shots} pxs={pxs} />
                      </div>
                    </div>
                    <p className="text-[12.5px] text-faint mt-2 flex items-center gap-1.5"><GripVertical className="h-3.5 w-3.5" />Drag a shot to reorder · drag its right edge (or use ← → on it) to change its length · double-click to edit.</p>
                  </div>
                </SortableContext>
              )}
              <DragOverlay>{dragShot && p.ui.boardMode === "storyboard" ? <div style={{ width: minCol + 20 }}><ShotCard p={p} s={dragShot} i={p.shots.indexOf(dragShot)} selected overlay /></div> : null}</DragOverlay>
            </DndContext>
          )}
          <div className="h-12" />
        </div>
      </div>
      {selShot && mobile && sheet && (
        <MobileSheet onClose={() => useMobileSheet.setState({ open: false })}>
          <ShotInspector key={selShot.id} shot={selShot} onClose={() => useMobileSheet.setState({ open: false })} />
        </MobileSheet>
      )}
      {selShot && !mobile && inspector && (
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }} className="flex min-h-0">
          <ShotInspector key={selShot.id} shot={selShot} onClose={() => st.setPrefs({ inspector: false })} />
        </motion.div>
      )}
      {selShot && !mobile && !inspector && (
        <button onClick={() => st.setPrefs({ inspector: true })} className="w-10 shrink-0 border-l border-line text-faint hover:text-ink hover:bg-white/[.03] text-[12px] [writing-mode:vertical-rl] tracking-wider" title="Show inspector ( ] )">SHOT INSPECTOR</button>
      )}
    </div>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return <div><div className="text-[22px] font-semibold tabular-nums leading-none">{v}</div><div className="text-[11.5px] text-faint mt-1">{l}</div></div>;
}

function Ruler({ shots, pxs }: { shots: Shot[]; pxs: number }) {
  let t = 0;
  return (
    <div className="flex gap-2 mt-2">
      {shots.map((s) => {
        const start = t; t += s.duration;
        return <div key={s.id} className="shrink-0 text-[11px] text-faint tabular-nums border-l border-line pl-1" style={{ width: Math.max(84, s.duration * pxs) }}>{fmtDur(start)}</div>;
      })}
      <div className="text-[11px] text-faint tabular-nums border-l border-line pl-1">{fmtDur(t)}</div>
    </div>
  );
}

export { STATUS_LABEL };
