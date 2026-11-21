import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect } from "react";
import { PreviewOverlay, SettingsOverlay, ShortcutsOverlay } from "./components/Overlays";
import { Logo, Sidebar, Toasts, TopBar } from "./components/Shell";
import { AskHost, ConfirmHost } from "./components/ui";
import type { View } from "./lib/types";
import { useStore } from "./store/store";
import { Characters, Locations } from "./views/Cast";
import Credits from "./views/Credits";
import Export from "./views/Export";
import Generate from "./views/Generate";
import Script from "./views/Script";
import NewFilm from "./views/NewFilm";
import PromptStudio from "./views/PromptStudio";
import ShotEditor from "./views/ShotEditor";
import Story from "./views/Story";
import Storyboard from "./views/Storyboard";
import { Projects, Studio } from "./views/Studio";
import Welcome from "./views/Welcome";

const ORDER: View[] = ["studio", "projects", "story", "script", "storyboard", "characters", "locations", "prompts", "generate", "credits", "export"];

function Workspace() {
  const view = useStore((s) => s.view), p = useStore((s) => s.project);
  const needs = !["studio", "projects"].includes(view);
  const body = needs && !p ? <Projects /> : view === "studio" ? <Studio /> : view === "projects" ? <Projects /> : view === "story" ? <Story /> : view === "script" ? <Script /> : view === "generate" ? <Generate /> : view === "storyboard" ? <Storyboard />
    : view === "shot" ? <ShotEditor /> : view === "characters" ? <Characters /> : view === "locations" ? <Locations /> : view === "prompts" ? <PromptStudio /> : view === "credits" ? <Credits /> : <Export />;
  const scrolls = view === "studio" || view === "projects";
  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className={scrolls ? "flex-1 min-w-0 overflow-y-auto thin-scroll" : "flex-1 min-w-0 min-h-0"}>
          <AnimatePresence mode="wait">
            <motion.div key={view + (p?.id ?? "")} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>{body}</motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const ready = useStore((s) => s.ready), screen = useStore((s) => s.screen), rm = useStore((s) => s.prefs.reduceMotion), saveErr = useStore((s) => s.save === "error" ? s.saveError : "");
  useEffect(() => { useStore.getState().init(); }, []);
  useEffect(() => { document.documentElement.classList.toggle("reduce-motion", rm); }, [rm]);
  useEffect(() => {
    const flush = () => { useStore.getState().saveNow(); };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);
    return () => { window.removeEventListener("beforeunload", flush); document.removeEventListener("visibilitychange", flush); };
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const st = useStore.getState();
      const t = e.target as HTMLElement;
      const typing = !!t.closest("input,textarea,select,[contenteditable=true]");
      const mod = e.metaKey || e.ctrlKey;
      if (st.overlay === "preview") return;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); st.saveNow().then(() => st.project && st.toast("Saved.", "ok")); return; }
      if (mod && e.key.toLowerCase() === "z" && !typing && st.screen === "app") { e.preventDefault(); e.shiftKey ? st.redo() : st.undo(); return; }
      if (mod && e.key.toLowerCase() === "y" && !typing && st.screen === "app") { e.preventDefault(); st.redo(); return; }
      if (typing || mod || st.screen !== "app" || st.overlay || t.closest("[role=dialog]")) return;
      if (e.altKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); st.go(ORDER[Number(e.key) - 1]); return; }
      if (e.altKey) return;
      if (e.key === "?") { st.setOverlay("shortcuts"); return; }
      if (e.key === "[") { st.setPrefs({ sidebar: !st.prefs.sidebar }); return; }
      if (e.key === "]") { st.setPrefs({ inspector: !st.prefs.inspector }); return; }
      if (e.key.toLowerCase() === "p" && st.project && !["studio", "projects"].includes(st.view)) { st.setOverlay("preview"); return; }
      if (e.key === "Escape" && st.view === "shot") st.go("storyboard");
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  if (!ready) return <div className="h-full grid place-items-center"><div className="animate-pulse"><Logo size={36} /></div></div>;
  return (
    <MotionConfig reducedMotion={rm ? "always" : "user"}>
      <div className="h-full">
        {screen === "welcome" ? <Welcome /> : screen === "new" ? <NewFilm /> : <Workspace />}
        {saveErr && <div role="alert" className="fixed top-16 left-1/2 -translate-x-1/2 z-[95] rounded-xl border border-bad/40 bg-[#2a1716] px-4 py-2.5 text-sm text-[#ffd9d6] shadow-pop">{saveErr}</div>}
        <PreviewOverlay />
        <SettingsOverlay />
        <ShortcutsOverlay />
        <ConfirmHost />
        <AskHost />
        <Toasts />
      </div>
    </MotionConfig>
  );
}
