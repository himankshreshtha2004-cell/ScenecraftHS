import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, BookOpen, Check, ChevronDown, CircleDollarSign, Clapperboard, CloudOff, Download, FolderOpen, Home, Keyboard, Loader2, MapPin,
  PanelLeftClose, PanelLeftOpen, Play, Plus, Redo2, ScrollText, Settings, Sparkles, Undo2, Users, Wand2, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { continuityStatus, projectIssues } from "../lib/checks";
import { ago } from "../lib/ids";
import type { View } from "../lib/types";
import { useStore } from "../store/store";
import { cx, IconButton, Menu } from "./ui";

export function Logo({ size = 30, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid place-items-center rounded-[9px] bg-amber text-[#1b1208]" style={{ width: size, height: size }}>
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="currentColor"><path d="M3.5 10h17v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" /><path d="m3.3 7.6 15.6-3.4.7 3.1L4 10.6z" /></svg>
      </span>
      {withText && <span className="text-[15px] font-bold tracking-[.18em]">SCENECRAFT</span>}
    </span>
  );
}

function SaveStatus() {
  const save = useStore((s) => s.save), at = useStore((s) => s.savedAt), err = useStore((s) => s.saveError);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 20000); return () => clearInterval(t); }, []);
  if (save === "error") return <span className="inline-flex items-center gap-1.5 text-[12.5px] text-bad" title={err}><CloudOff className="h-4 w-4" />Not saved</span>;
  if (save === "saving") return <span className="inline-flex items-center gap-1.5 text-[12.5px] text-mute whitespace-nowrap"><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</span>;
  if (save === "saved") return <span className="inline-flex items-center gap-1.5 text-[12.5px] text-mute whitespace-nowrap" title="Saved in this browser"><Check className="h-3.5 w-3.5 text-ok" />Saved {ago(at)}</span>;
  return null;
}

export function TopBar() {
  const p = useStore((s) => s.project), view = useStore((s) => s.view), metas = useStore((s) => s.metas);
  const st = useStore.getState();
  const past = useStore((s) => s.past.length), future = useStore((s) => s.future.length);
  const inProject = !!p && view !== "studio" && view !== "projects";
  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-line bg-bg/95 backdrop-blur z-30">
      <button onClick={() => st.go("studio")} className="rounded-lg px-1 py-1 hover:bg-white/[.04]" aria-label="SceneCraft — My Studio"><Logo size={28} /></button>
      <div className="h-6 w-px bg-line mx-1" />
      {inProject && p ? (
        <Menu align="left" trigger={(open, toggle) => (
          <button onClick={toggle} aria-expanded={open} className="flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-lg hover:bg-white/[.05] min-w-0">
            <span className="font-serif text-[22px] leading-none truncate max-w-[300px]">{p.title}</span>
            {p.isSample && <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ai bg-ai-soft rounded px-1.5 py-0.5">Sample</span>}
            <ChevronDown className="h-4 w-4 text-faint" />
          </button>
        )} items={[
          ...metas.filter((m) => m.id !== p.id).slice(0, 6).map((m) => ({ label: m.title, icon: <Clapperboard className="h-4 w-4" />, onClick: () => st.openProject(m.id) })),
          ...(metas.length > 1 ? ["sep" as const] : []),
          { label: "All projects", icon: <FolderOpen className="h-4 w-4" />, onClick: () => st.go("projects") },
          { label: "Start a new film", icon: <Plus className="h-4 w-4" />, onClick: () => st.setScreen("new") },
        ]} />
      ) : (
        <span className="text-sm text-mute">{view === "projects" ? "Projects" : "My Studio"}</span>
      )}
      <div className="flex-1" />
      {inProject && (
        <>
          <SaveStatus />
          <div className="h-6 w-px bg-line mx-1" />
          <IconButton label="Undo (Ctrl+Z)" disabled={!past} onClick={st.undo}><Undo2 className="h-[18px] w-[18px]" /></IconButton>
          <IconButton label="Redo (Ctrl+Shift+Z)" disabled={!future} onClick={st.redo}><Redo2 className="h-[18px] w-[18px]" /></IconButton>
          <div className="h-6 w-px bg-line mx-1" />
          <button onClick={() => st.setOverlay("preview")} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium text-ink/90 hover:bg-white/[.06]" title="Play the storyboard as an animatic (P)">
            <Play className="h-4 w-4" />Preview
          </button>
          <button onClick={() => st.go("export")} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-amber text-[#1b1208] hover:bg-[#f0bd8c]">
            <Download className="h-4 w-4" />Export
          </button>
        </>
      )}
      {!inProject && (
        <button onClick={() => st.setScreen("new")} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-amber text-[#1b1208] hover:bg-[#f0bd8c]"><Plus className="h-4 w-4" />New film</button>
      )}
      <IconButton label="Keyboard shortcuts (?)" onClick={() => st.setOverlay("shortcuts")}><Keyboard className="h-[18px] w-[18px]" /></IconButton>
      <IconButton label="Settings" onClick={() => st.setOverlay("settings")}><Settings className="h-[18px] w-[18px]" /></IconButton>
    </header>
  );
}

const NAV: { v: View; label: string; icon: any; project?: boolean }[] = [
  { v: "studio", label: "My Studio", icon: Home },
  { v: "projects", label: "Projects", icon: FolderOpen },
  { v: "story", label: "Story", icon: BookOpen, project: true },
  { v: "script", label: "Script", icon: ScrollText, project: true },
  { v: "storyboard", label: "Storyboard", icon: Clapperboard, project: true },
  { v: "characters", label: "Characters", icon: Users, project: true },
  { v: "locations", label: "Locations", icon: MapPin, project: true },
  { v: "prompts", label: "Prompt Studio", icon: Sparkles, project: true },
  { v: "generate", label: "Generate", icon: Wand2, project: true },
  { v: "credits", label: "Credit Planner", icon: CircleDollarSign, project: true },
  { v: "export", label: "Export", icon: Download, project: true },
];

function useNarrow(q = "(max-width: 1180px)") {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, [q]);
  return m;
}

export function Sidebar() {
  const view = useStore((s) => s.view), pref = useStore((s) => s.prefs.sidebar), p = useStore((s) => s.project);
  const narrow = useNarrow();
  const [peek, setPeek] = useState(false);
  const open = narrow ? peek : pref;
  const st = useStore.getState();
  const issues = p ? projectIssues(p).filter((i) => !i.acknowledged) : [];
  const cs = continuityStatus(issues);
  const active = view === "shot" ? "storyboard" : view;
  return (
    <nav aria-label="Main" className={cx("shrink-0 border-r border-line bg-bg flex flex-col transition-[width] duration-200", open ? "w-[216px]" : "w-[64px]")}>
      <div className="flex-1 overflow-y-auto thin-scroll py-3 px-2.5 space-y-0.5">
        {NAV.map((n, i) => {
          const disabled = n.project && !p;
          const on = active === n.v;
          const Icon = n.icon;
          return (
            <div key={n.v}>
              {i === 2 && <div className={cx("pt-4 pb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-[.14em] text-faint truncate", !open && "text-center px-0")}>{open ? (p ? p.title : "Project") : "·"}</div>}
              <button
                onClick={() => !disabled && st.go(n.v)}
                disabled={disabled}
                title={disabled ? "Open a project first" : n.label}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "group relative w-full flex items-center gap-3 h-10 rounded-xl text-[14px] font-medium transition-colors",
                  open ? "px-3" : "justify-center",
                  on ? "bg-white/[.07] text-ink" : "text-mute hover:text-ink hover:bg-white/[.04]",
                  disabled && "opacity-35 pointer-events-none",
                )}
              >
                {on && <motion.span layoutId="navmark" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-amber" />}
                <Icon className={cx("h-[18px] w-[18px] shrink-0", on && "text-amber")} />
                {open && <span className="flex-1 text-left truncate">{n.label}</span>}
                {open && n.v === "storyboard" && p && <span className="text-[11.5px] text-faint">{p.shots.length}</span>}
                {open && n.v === "generate" && p && p.shots.length > 0 && <span className="text-[11.5px] text-faint tabular-nums">{p.shots.filter((s) => s.generated).length}/{p.shots.length}</span>}
                {n.v === "prompts" && p && cs !== "ready" && (
                  <span className={cx("grid place-items-center rounded-full text-[10.5px] font-bold", open ? "h-5 min-w-5 px-1.5" : "absolute top-1 right-1 h-4 min-w-4 px-1", cs === "conflict" ? "bg-bad text-[#2a0f0d]" : "bg-warn text-[#2a2208]")} title={`${issues.length} continuity ${issues.length === 1 ? "issue" : "issues"}`}>{issues.length}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <div className="p-2.5 border-t border-line">
        <button onClick={() => (narrow ? setPeek(!peek) : st.setPrefs({ sidebar: !open }))} className={cx("w-full flex items-center gap-3 h-9 rounded-lg text-[13px] text-faint hover:text-ink hover:bg-white/[.04]", open ? "px-3" : "justify-center")} aria-label={open ? "Collapse sidebar ([)" : "Expand sidebar ([)"} title={open ? "Collapse sidebar ( [ )" : "Expand sidebar ( [ )"}>
          {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}{open && "Collapse"}
        </button>
      </div>
    </nav>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center gap-2 pointer-events-none" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.18 }}
            className={cx("pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm shadow-pop max-w-[560px]",
              t.tone === "error" ? "bg-[#2a1716] border-bad/40 text-[#ffd9d6]" : "bg-panel border-line text-ink")}>
            {t.tone === "error" ? <AlertTriangle className="h-4 w-4 text-bad shrink-0" /> : t.tone === "ok" ? <span className="grid place-items-center h-5 w-5 rounded-full bg-ok/20"><Check className="h-3.5 w-3.5 text-ok" /></span> : <Sparkles className="h-4 w-4 text-ai shrink-0" />}
            <span className="leading-snug">{t.text}</span>
            {t.action && <button onClick={() => { t.action!.run(); useStore.getState().dismiss(t.id); }} className="font-semibold text-amber hover:underline whitespace-nowrap">{t.action.label}</button>}
            <button onClick={() => useStore.getState().dismiss(t.id)} aria-label="Dismiss" className="text-faint hover:text-ink"><X className="h-3.5 w-3.5" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
