import { motion } from "framer-motion";
import { ArrowRight, Clapperboard, Copy, Download, FolderOpen, MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { askText, AssetImg, Button, Card, confirmDialog, cx, Empty, FileButton, IconButton, Input, Menu, Pill, Progress, Segmented } from "../components/ui";
import { ago, fmtLong, slug } from "../lib/ids";
import { download } from "../lib/download";
import type { ProjectMeta } from "../lib/types";
import { useStore } from "../store/store";


export function ProjectCard({ m, big }: { m: ProjectMeta; big?: boolean }) {
  const st = useStore.getState();
  const pct = Math.round(m.readiness * 100);
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="group">
      <Card className="overflow-hidden hover:border-[#454959] transition-colors">
        <button onClick={() => st.openProject(m.id)} className="block w-full text-left" aria-label={`Open ${m.title}`}>
          <AssetImg id={m.coverAssetId} assets={[]} aspect="16:9" rounded="rounded-none" label={false} className="group-hover:[&_img]:scale-[1.02] [&_img]:transition-transform [&_img]:duration-500">
            {!m.coverAssetId && <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,#2a2d3a,#15161c)]"><Clapperboard className="h-8 w-8 text-faint" /></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute left-4 right-4 bottom-3 flex items-end justify-between gap-2">
              <h3 className={cx("font-serif leading-none drop-shadow", big ? "text-[34px]" : "text-[26px]")}>{m.title}</h3>
              {m.isSample && <Pill tone="ai">Sample</Pill>}
            </div>
          </AssetImg>
        </button>
        <div className="p-4 pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] text-mute truncate">{m.genre} · {m.aspect}</div>
            <Menu trigger={(_, t) => <IconButton label="Project actions" onClick={t} className="-mr-1.5 h-8 w-8"><MoreHorizontal className="h-4 w-4" /></IconButton>} items={[
              { label: "Open", icon: <FolderOpen className="h-4 w-4" />, onClick: () => st.openProject(m.id) },
              { label: "Rename", icon: <Pencil className="h-4 w-4" />, onClick: async () => { const t = await askText({ title: "Rename project", value: m.title }); if (t != null) st.renameProject(m.id, t); } },
              { label: "Duplicate", icon: <Copy className="h-4 w-4" />, onClick: () => st.duplicateProject(m.id) },
              { label: "Download backup", icon: <Download className="h-4 w-4" />, onClick: async () => download(await st.backupBlob(m.id), `${slug(m.title)}.scenecraft.json`) },
              "sep",
              { label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: async () => {
                if (await confirmDialog({ title: `Delete “${m.title}”?`, body: "Its shots, prompts and images will be removed from this browser. Download a backup first if you might need it.", ok: "Delete project", danger: true })) { await st.deleteProject(m.id); st.toast(`Deleted “${m.title}”.`, "ok"); }
              } },
            ]} />
          </div>
          <div className="mt-2 flex items-center gap-3 text-[12.5px] text-faint">
            <span>{m.scenes} {m.scenes === 1 ? "scene" : "scenes"}</span><span>·</span><span>{m.shots} shots</span><span>·</span><span>{fmtLong(m.duration)}</span>
            <span className="ml-auto">{ago(m.updatedAt)}</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={m.readiness} tone={pct === 100 ? "ok" : "amber"} className="flex-1" />
            <span className={cx("text-[12px] font-semibold tabular-nums", pct === 100 ? "text-ok" : "text-mute")}>{pct}% ready</span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function Studio() {
  const metas = useStore((s) => s.metas), last = useStore((s) => s.lastProjectId);
  const st = useStore.getState();
  const recent = metas.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const cont = recent.find((m) => m.id === last) ?? recent[0];
  const hasSample = metas.some((m) => m.isSample);
  return (
    <div className="max-w-[1320px] mx-auto px-10 py-10">
      <div className="text-[12px] font-semibold uppercase tracking-[.2em] text-faint">My Studio</div>
      <h1 className="font-serif text-[52px] leading-none mt-2">What are we making today?</h1>
      <div className="grid grid-cols-[1.35fr_1fr] gap-6 mt-9">
        {cont ? (
          <div>
            <div className="text-[13px] font-medium text-mute mb-3">Continue where you left off</div>
            <ProjectCard m={cont} big />
          </div>
        ) : (
          <Card className="grid place-items-center p-10 text-center">
            <div><Clapperboard className="h-8 w-8 text-faint mx-auto" /><p className="mt-3 text-mute">No films yet. Start one, or open the sample to see how SceneCraft works.</p></div>
          </Card>
        )}
        <div className="flex flex-col gap-4">
          <div className="text-[13px] font-medium text-mute">Start something</div>
          <button onClick={() => st.setScreen("new")} className="group flex-1 text-left rounded-2xl border border-amber/30 bg-[linear-gradient(135deg,rgba(232,175,121,.14),rgba(232,175,121,.03))] p-6 hover:border-amber/60 transition-colors">
            <Plus className="h-6 w-6 text-amber" />
            <div className="font-serif text-[30px] mt-4 leading-none">Start a new film</div>
            <p className="text-sm text-mute mt-2 max-w-sm">Describe your idea — SceneCraft writes the scenes, dialogue and shot-by-shot prompts.</p>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber mt-4">Begin <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
          </button>
          {!hasSample && (
            <button onClick={() => st.createSample()} className="text-left rounded-2xl border border-ai/25 bg-ai-soft/40 p-5 hover:border-ai/50 transition-colors">
              <div className="flex items-center gap-2 text-ai text-sm font-semibold"><Sparkles className="h-4 w-4" />Sample film</div>
              <div className="font-serif text-[24px] mt-2 leading-none">Midnight Echo</div>
              <p className="text-[13px] text-mute mt-1.5">A six-shot neo-noir plan with locked characters, locations and prompts. Pictures are sample illustrations.</p>
            </button>
          )}
          {hasSample && (
            <Card className="p-5">
              <div className="text-sm font-semibold">How SceneCraft works</div>
              <ol className="mt-2 space-y-1 text-[13px] text-mute list-decimal list-inside">
                <li>Describe an idea — AI writes scenes and dialogue</li><li>Lock characters, places and style</li><li>Refine shots, prompts and continuity</li><li>Generate each shot in Higgsfield or Sora</li>
              </ol>
            </Card>
          )}
        </div>
      </div>
      {recent.length > 1 && (
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[17px] font-semibold">Recent films</h2>
            <Button tone="ghost" size="sm" onClick={() => st.go("projects")}>All projects<ArrowRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-3 gap-5">{recent.filter((m) => m.id !== cont?.id).slice(0, 3).map((m) => <ProjectCard key={m.id} m={m} />)}</div>
        </div>
      )}
    </div>
  );
}

export function Projects() {
  const metas = useStore((s) => s.metas);
  const st = useStore.getState();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "title" | "ready">("recent");
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    const l = metas.filter((m) => !k || m.title.toLowerCase().includes(k) || m.genre.toLowerCase().includes(k));
    return l.sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : sort === "ready" ? b.readiness - a.readiness : b.updatedAt - a.updatedAt);
  }, [metas, q, sort]);
  return (
    <div className="max-w-[1320px] mx-auto px-10 py-10">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[.2em] text-faint">Projects</div>
          <h1 className="font-serif text-[48px] leading-none mt-2">All films <span className="text-faint">{metas.length}</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <FileButton accept=".json,application/json" icon={<Upload className="h-4 w-4" />} onFiles={async (f) => { try { await st.importBackup(f[0]); } catch (e: any) { st.toast(e.message, "error"); } }}>Import backup</FileButton>
          <Button tone="primary" icon={<Plus className="h-4 w-4" />} onClick={() => st.setScreen("new")}>New film</Button>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-8">
        <div className="relative w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or genre" className="pl-9" aria-label="Search projects" />
        </div>
        <Segmented value={sort} onChange={setSort} options={[{ value: "recent", label: "Last edited" }, { value: "title", label: "Title" }, { value: "ready", label: "Readiness" }]} />
        {!metas.some((m) => m.isSample) && <Button tone="ai" size="md" icon={<Sparkles className="h-4 w-4" />} onClick={() => st.createSample()} className="ml-auto">Open sample film</Button>}
      </div>
      {list.length ? (
        <div className="grid grid-cols-3 gap-5 mt-6">{list.map((m) => <ProjectCard key={m.id} m={m} />)}</div>
      ) : (
        <Empty icon={<Clapperboard className="h-6 w-6" />} title={metas.length ? "No films match your search" : "No films yet"} body={metas.length ? "Try a different word." : "Start a new film or open the sample to explore."}
          action={!metas.length && <Button tone="primary" onClick={() => st.setScreen("new")}>Start a new film</Button>} />
      )}
    </div>
  );
}
