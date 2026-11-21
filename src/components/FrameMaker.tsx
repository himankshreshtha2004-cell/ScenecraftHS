import { Camera, Loader2, PenTool, Square, Wand2 } from "lucide-react";
import { frameModes, makeFrames, modeLabel, useFrameJob, type FrameMode } from "../lib/frames";
import type { Project } from "../lib/types";
import { useStore } from "../store/store";
import { Button, Menu, Progress } from "./ui";

/** "Make storyboard frames" — fills every empty shot with a photo or a drawn sketch */
export function MakeFramesButton({ p, size = "md" }: { p: Project; size?: "sm" | "md" }) {
  useStore((s) => s.ai);
  const job = useFrameJob();
  const modes = frameModes();
  const missing = p.shots.filter((s) => !s.imageId).length;
  const st = useStore.getState();
  if (job.running) return <Button size={size} tone="ai" disabled icon={<Loader2 className="h-4 w-4 animate-spin" />}>Making frames {job.done}/{job.total}</Button>;
  if (!modes.length) return <Button size={size} tone="ai" icon={<Wand2 className="h-4 w-4" />} onClick={() => st.setOverlay("settings")} title="Needs AI — open Settings">Make frames</Button>;
  const items = (all: boolean) => modes.map((m: FrameMode) => ({
    label: `${all ? "Redo all as" : "Make"} ${modeLabel(m)}`, icon: m === "photo" ? <Camera className="h-4 w-4" /> : <PenTool className="h-4 w-4" />,
    onClick: () => makeFrames(m, all ? p.shots.map((s) => s.id) : undefined),
  }));
  return (
    <Menu trigger={(_, t) => <Button size={size} tone="ai" icon={<Wand2 className="h-4 w-4" />} onClick={t}>{missing ? `Make ${missing} storyboard ${missing === 1 ? "frame" : "frames"}` : "Remake frames"}</Button>}
      items={[...(missing ? items(false) : []), ...(missing ? ["sep" as const] : []), ...items(true)]} />
  );
}

export function FrameJobBar() {
  const job = useFrameJob();
  if (!job.running) return null;
  return (
    <div className="rounded-2xl border border-ai/35 bg-ai-soft/40 px-5 py-3.5 flex items-center gap-4">
      <Loader2 className="h-5 w-5 text-ai animate-spin shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold">Making storyboard {job.mode === "photo" ? "photos" : "sketches"} — {job.done} of {job.total}</div>
        <div className="text-[12px] text-mute truncate">{job.current || "Starting…"}{job.mode === "photo" ? " · the free image service allows about one picture every 15 seconds" : ""}</div>
        <Progress value={job.total ? job.done / job.total : 0} tone="ai" className="mt-2" />
      </div>
      <Button size="sm" tone="ghost" icon={<Square className="h-3.5 w-3.5" />} onClick={() => useFrameJob.setState({ cancel: true })}>Stop</Button>
    </div>
  );
}
