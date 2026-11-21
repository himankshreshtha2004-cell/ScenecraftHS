import { motion } from "framer-motion";
import { ArrowRight, FolderOpen, Play } from "lucide-react";
import { useMemo } from "react";
import { Logo } from "../components/Shell";
import { Button } from "../components/ui";
import { artCity, artEncounter, artMessage, artNewLead, artReturn, artRevelation } from "../lib/art";
import { useStore } from "../store/store";

const url = (s: string) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);

export default function Welcome() {
  const st = useStore.getState();
  const metas = useStore((s) => s.metas), last = useStore((s) => s.lastProjectId), rm = useStore((s) => s.prefs.reduceMotion);
  const lastMeta = metas.find((m) => m.id === last);
  const frames = useMemo(() => [artCity(), artReturn("far"), artMessage(true), artEncounter(), artRevelation(), artNewLead()].map(url), []);
  const strip = [...frames, ...frames, ...frames];
  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      {/* filmstrip */}
      <div className="absolute inset-y-0 right-0 w-[58%] overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_28%,black_80%,transparent)]" aria-hidden>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-[8deg] space-y-6 w-[5800px] origin-left">
          {[0, 1, 2].map((row) => (
            <div key={row} className="relative">
              <motion.div className="flex gap-4 bg-[#07070a] py-4 px-4 rounded-md w-max"
                animate={rm ? undefined : { x: row % 2 ? ["-33.333%", "0%"] : ["0%", "-33.333%"] }} transition={{ duration: 120 + row * 20, repeat: Infinity, ease: "linear" }}>
                {strip.map((f, i) => (
                  <div key={i} className="relative shrink-0 w-[300px] aspect-video rounded-[6px] overflow-hidden ring-1 ring-white/5">
                    <img src={frames[(i + row * 2) % frames.length]} alt="" className="h-full w-full object-cover opacity-90" />
                  </div>
                ))}
              </motion.div>
              <div className="absolute inset-x-0 top-1 h-2 flex gap-[18px] px-3 opacity-40">{Array.from({ length: 120 }).map((_, i) => <span key={i} className="h-2 w-3 shrink-0 rounded-[2px] bg-[#1e1f27]" />)}</div>
              <div className="absolute inset-x-0 bottom-1 h-2 flex gap-[18px] px-3 opacity-40">{Array.from({ length: 120 }).map((_, i) => <span key={i} className="h-2 w-3 shrink-0 rounded-[2px] bg-[#1e1f27]" />)}</div>
            </div>
          ))}
        </div>
        <span className="absolute bottom-6 right-8 text-[11px] uppercase tracking-[.16em] text-faint">Illustrations from the sample film</span>
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_20%_50%,rgba(16,17,22,.96)_35%,rgba(16,17,22,.4)_75%,transparent)]" />
      <div className="film-grain" />

      <div className="relative h-full flex flex-col px-[7vw] py-10">
        <Logo size={34} />
        <div className="flex-1 flex flex-col justify-center max-w-[640px]">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}>
            <div className="text-[12px] font-semibold uppercase tracking-[.24em] text-amber mb-6">AI film pre-production studio</div>
            <h1 className="font-serif text-[clamp(56px,7.4vw,112px)] leading-[.92] tracking-[-.02em]">SceneCraft</h1>
            <p className="font-serif italic text-[clamp(24px,2.4vw,34px)] text-ink/85 mt-5 leading-tight">Your next great film begins<br />before the first frame.</p>
            <p className="text-[15.5px] text-mute mt-6 max-w-[480px] leading-relaxed">Describe an idea. SceneCraft writes the scenes and dialogue, plans every shot with consistent characters and places, and hands you ready-to-paste prompts for Higgsfield or Sora — one shot at a time.</p>
          </motion.div>
          <motion.div className="flex flex-wrap items-center gap-3 mt-10" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}>
            <Button tone="primary" size="lg" onClick={() => st.setScreen("new")}>Start a New Film<ArrowRight className="h-4 w-4" /></Button>
            <Button tone="subtle" size="lg" icon={<FolderOpen className="h-4 w-4" />} onClick={() => st.go("studio")}>Open My Projects</Button>
          </motion.div>
          {lastMeta ? (
            <button onClick={() => st.openProject(lastMeta.id)} className="mt-6 self-start text-sm text-mute hover:text-ink inline-flex items-center gap-2">
              <Play className="h-3.5 w-3.5 text-amber" />Continue <span className="text-ink font-medium">{lastMeta.title}</span>
            </button>
          ) : !metas.some((m) => m.isSample) ? (
            <button onClick={() => st.createSample()} className="mt-6 self-start text-sm text-mute hover:text-ink inline-flex items-center gap-2">
              <Play className="h-3.5 w-3.5 text-ai" />Explore the sample film <span className="text-ink font-medium">Midnight Echo</span>
            </button>
          ) : null}
        </div>
        <div className="text-[12.5px] text-faint">Perfect every frame before you generate. · Everything is saved in this browser.</div>
      </div>
    </div>
  );
}
