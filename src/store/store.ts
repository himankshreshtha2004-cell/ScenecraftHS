import { create } from "zustand";
import { checkAI, type AIStatus } from "../lib/ai";
import { blobOf, loadAssetsFor, prepareImage, storeBlob } from "../lib/assets";
import { projectReadiness, totalDuration } from "../lib/checks";
import { db, deleteAssets, deleteProjectData, loadProject, loadProjects, putAsset, saveProject } from "../lib/db";
import { uid } from "../lib/ids";
import { createSampleProject, emptyProject, normalizeProject } from "../lib/sample";
import type { Asset, Project, ProjectMeta, ProjectUI, View } from "../lib/types";

export type Screen = "welcome" | "new" | "app";
export interface Toast { id: string; text: string; tone: "ok" | "info" | "error"; action?: { label: string; run: () => void } }
export interface Prefs { sidebar: boolean; inspector: boolean; advanced: boolean; reduceMotion: boolean }

interface State {
  ready: boolean;
  screen: Screen;
  view: View;
  metas: ProjectMeta[];
  project: Project | null;
  past: Project[];
  future: Project[];
  save: "idle" | "saving" | "saved" | "error";
  savedAt: number;
  saveError: string;
  toasts: Toast[];
  prefs: Prefs;
  ai: AIStatus;
  overlay: null | "preview" | "settings" | "shortcuts" | "continuity" | "switcher";
  lastProjectId: string | null;

  init: () => Promise<void>;
  go: (v: View) => void;
  setScreen: (s: Screen) => void;
  openProject: (id: string, view?: View) => Promise<void>;
  closeProject: () => void;
  createProject: (p: Project) => Promise<void>;
  createSample: () => Promise<void>;
  renameProject: (id: string, title: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  importBackup: (file: File) => Promise<void>;
  backupBlob: (id: string) => Promise<Blob>;

  update: (fn: (p: Project) => void, coalesce?: string) => void;
  setUI: (u: Partial<ProjectUI>) => void;
  undo: () => void;
  redo: () => void;
  saveNow: () => Promise<void>;
  addImages: (files: FileList | File[], tags: string[]) => Promise<Asset[]>;
  addGenerated: (b64: string, mime: string, name: string, tags: string[]) => Promise<Asset | null>;

  toast: (text: string, tone?: Toast["tone"], action?: Toast["action"]) => void;
  dismiss: (id: string) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  setOverlay: (o: State["overlay"]) => void;
  refreshAI: () => Promise<void>;
}

const PREFS_KEY = "scenecraft.prefs", LAST_KEY = "scenecraft.lastProject";
const readPrefs = (): Prefs => {
  const d: Prefs = { sidebar: true, inspector: true, advanced: false, reduceMotion: false };
  try { return { ...d, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return d; }
};
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export function metaOf(p: Project): ProjectMeta {
  return {
    id: p.id, title: p.title, genre: p.genre, coverAssetId: p.coverAssetId ?? p.shots.find((s) => s.imageId)?.imageId ?? null,
    scenes: p.scenes.length, shots: p.shots.length, duration: totalDuration(p), readiness: projectReadiness(p),
    isSample: p.isSample, updatedAt: p.updatedAt, aspect: p.aspect,
  };
}

const clone = <T,>(x: T): T => structuredClone(x);
let lastKey = "", lastAt = 0, saveTimer: number | undefined;

export const useStore = create<State>((set, get) => ({
  ready: false, screen: "welcome", view: "studio", metas: [], project: null, past: [], future: [],
  save: "idle", savedAt: 0, saveError: "", toasts: [], prefs: readPrefs(),
  ai: { checked: false, text: false, image: false, provider: "", imageProvider: "" }, overlay: null, lastProjectId: ls.get(LAST_KEY),

  async init() {
    try {
      const ps = await loadProjects();
      set({ metas: ps.map(metaOf), ready: true });
      const last = get().lastProjectId;
      if (last && !ps.some((p) => p.id === last)) set({ lastProjectId: null });
      // cover images for the project cards
      ps.forEach((p) => { const c = metaOf(p).coverAssetId; if (c) blobOf(c); });
    } catch (e) {
      set({ ready: true, save: "error", saveError: "This browser blocked local storage, so work can't be saved. Try a normal (not private) window." });
    }
    get().refreshAI();
  },
  async refreshAI() { set({ ai: await checkAI() }); },

  go(v) {
    if ((v === "studio" || v === "projects") ) { set({ view: v, screen: "app" }); return; }
    if (!get().project) { set({ view: "projects", screen: "app" }); return; }
    set({ view: v, screen: "app" });
    get().setUI({ view: v });
  },
  setScreen(s) { set({ screen: s }); },

  async openProject(id, view) {
    await get().saveNow();
    const raw = await loadProject(id);
    if (!raw) { get().toast("That project couldn't be found.", "error"); return; }
    const p = normalizeProject(raw);
    await loadAssetsFor(id);
    ls.set(LAST_KEY, id);
    const v = view ?? (p.ui.view === "studio" || p.ui.view === "projects" ? "storyboard" : p.ui.view);
    set({ project: p, past: [], future: [], view: v, screen: "app", save: "saved", savedAt: p.updatedAt, lastProjectId: id });
  },
  closeProject() { get().saveNow(); set({ view: "studio", screen: "app" }); },

  async createProject(p) {
    await saveProject(p);
    set((s) => ({ metas: [metaOf(p), ...s.metas] }));
    await get().openProject(p.id, "storyboard");
  },
  async createSample() {
    const p = await createSampleProject();
    await get().createProject(p);
    get().toast("Opened the sample film “Midnight Echo”. Its pictures are labelled sample illustrations.", "info");
  },
  async renameProject(id, title) {
    title = title.trim() || "Untitled film";
    const cur = get().project;
    if (cur?.id === id) { get().update((p) => { p.title = title; }); return; }
    const p = await loadProject(id); if (!p) return;
    p.title = title; p.updatedAt = Date.now(); await saveProject(p);
    set((s) => ({ metas: s.metas.map((m) => (m.id === id ? metaOf(p) : m)) }));
  },
  async duplicateProject(id) {
    await get().saveNow();
    const p = await loadProject(id); if (!p) return;
    const rows = await db.assets.where("projectId").equals(id).toArray();
    let json = JSON.stringify(p);
    const nid = uid("p_");
    json = json.split(p.id).join(nid);
    const map: [string, string][] = rows.map((r) => [r.id, uid("a_")]);
    for (const [a, b] of map) json = json.split(a).join(b);
    const np: Project = JSON.parse(json);
    np.title = `${p.title} (copy)`; np.createdAt = np.updatedAt = Date.now(); np.isSample = p.isSample;
    for (const [a, b] of map) { const r = rows.find((x) => x.id === a)!; await putAsset(b, nid, r.blob); }
    await saveProject(np);
    await loadAssetsFor(nid);
    set((s) => ({ metas: [metaOf(np), ...s.metas] }));
    get().toast(`Duplicated as “${np.title}”.`, "ok");
  },
  async deleteProject(id) {
    await deleteProjectData(id);
    if (get().project?.id === id) set({ project: null, past: [], future: [], view: "studio" });
    if (get().lastProjectId === id) { ls.set(LAST_KEY, null); set({ lastProjectId: null }); }
    set((s) => ({ metas: s.metas.filter((m) => m.id !== id) }));
  },
  async backupBlob(id) {
    await get().saveNow();
    const p = await loadProject(id); if (!p) throw new Error("Project not found");
    const assets: Record<string, string> = {};
    for (const a of p.assets) {
      const b = await blobOf(a.id); if (!b) continue;
      assets[a.id] = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(b); });
    }
    return new Blob([JSON.stringify({ app: "scenecraft", format: 1, project: p, assets })], { type: "application/json" });
  },
  async importBackup(file) {
    let j: any;
    try { j = JSON.parse(await file.text()); } catch { throw new Error("That file isn't a SceneCraft backup (it isn't valid JSON)."); }
    if (j?.app !== "scenecraft" || !j.project?.shots) throw new Error("That file isn't a SceneCraft project backup.");
    let json = JSON.stringify(j.project);
    const oldId = j.project.id, nid = uid("p_");
    json = json.split(oldId).join(nid);
    const ids = Object.keys(j.assets || {}).map((a) => [a, uid("a_")] as [string, string]);
    for (const [a, b] of ids) json = json.split(a).join(b);
    const p: Project = JSON.parse(json);
    for (const [a, b] of ids) { const blob = await (await fetch(j.assets[a])).blob(); await putAsset(b, nid, blob); }
    p.updatedAt = Date.now();
    if (get().metas.some((m) => m.title === p.title)) p.title += " (imported)";
    await saveProject(p);
    await loadAssetsFor(nid);
    set((s) => ({ metas: [metaOf(p), ...s.metas] }));
    get().toast(`Imported “${p.title}”.`, "ok");
  },

  update(fn, coalesce) {
    const cur = get().project; if (!cur) return;
    const next = clone(cur);
    fn(next);
    next.updatedAt = Date.now();
    const now = Date.now();
    const merge = coalesce && coalesce === lastKey && now - lastAt < 900;
    lastKey = coalesce || ""; lastAt = now;
    set((s) => ({
      project: next,
      past: merge ? s.past : [...s.past.slice(-79), cur],
      future: [],
      save: "saving",
    }));
    schedule();
  },
  setUI(u) {
    const cur = get().project; if (!cur) return;
    set({ project: { ...cur, ui: { ...cur.ui, ...u } } });
    schedule();
  },
  undo() {
    const { past, project } = get(); if (!past.length || !project) return;
    const prev = { ...past[past.length - 1], ui: project.ui };
    set((s) => ({ project: prev, past: s.past.slice(0, -1), future: [project, ...s.future].slice(0, 80), save: "saving" }));
    lastKey = ""; schedule();
  },
  redo() {
    const { future, project } = get(); if (!future.length || !project) return;
    const nx = { ...future[0], ui: project.ui };
    set((s) => ({ project: nx, future: s.future.slice(1), past: [...s.past, project], save: "saving" }));
    lastKey = ""; schedule();
  },
  async saveNow() {
    clearTimeout(saveTimer);
    const p = get().project; if (!p) return;
    try {
      await saveProject(p);
      set((s) => ({ save: "saved", savedAt: Date.now(), saveError: "", metas: s.metas.some((m) => m.id === p.id) ? s.metas.map((m) => (m.id === p.id ? metaOf(p) : m)) : [metaOf(p), ...s.metas] }));
    } catch (e: any) {
      const quota = /quota/i.test(String(e?.name || e?.message));
      set({ save: "error", saveError: quota ? "The browser's storage is full. Delete unused images or projects, then try again." : "Couldn't save to this browser's storage." });
    }
  },
  async addImages(files, tags) {
    const p = get().project; if (!p) return [];
    const out: Asset[] = [];
    for (const f of Array.from(files)) {
      try {
        const img = await prepareImage(f);
        out.push(await storeBlob(p.id, img.blob, { name: f.name, mime: img.mime, width: img.width, height: img.height, origin: "upload", tags }));
      } catch (e: any) {
        get().toast(e?.message || `Couldn't add ${f.name}.`, "error");
      }
    }
    if (out.length) get().update((d) => { d.assets.push(...out); });
    return out;
  },
  async addGenerated(b64, mime, name, tags) {
    const p = get().project; if (!p) return null;
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bin], { type: mime || "image/png" });
    const bmp = await createImageBitmap(blob).catch(() => null);
    const a = await storeBlob(p.id, blob, { name, mime: blob.type, width: bmp?.width ?? 0, height: bmp?.height ?? 0, origin: "generated", tags });
    bmp?.close?.();
    get().update((d) => { d.assets.push(a); });
    return a;
  },

  toast(text, tone = "ok", action) {
    const id = uid("t_");
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone, action }] }));
    setTimeout(() => get().dismiss(id), tone === "error" ? 7000 : action ? 6500 : 3200);
  },
  dismiss(id) { set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })); },
  setPrefs(p) { const n = { ...get().prefs, ...p }; ls.set(PREFS_KEY, JSON.stringify(n)); set({ prefs: n }); },
  setOverlay(o) { set({ overlay: o }); },
}));

function schedule() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => useStore.getState().saveNow(), 450);
}

/** removes stored images that nothing in the project refers to any more (run on demand from Settings) */
export async function cleanUnusedAssets() {
  const st = useStore.getState(); const p = st.project; if (!p) return 0;
  const json = JSON.stringify({ ...p, assets: [] });
  const unused = p.assets.filter((a) => !json.includes(a.id)).map((a) => a.id);
  if (!unused.length) return 0;
  await deleteAssets(unused);
  st.update((d) => { d.assets = d.assets.filter((a) => !unused.includes(a.id)); });
  return unused.length;
}

export const useProject = () => useStore((s) => s.project);
export function useShot(id: string | null | undefined) {
  return useStore((s) => s.project?.shots.find((x) => x.id === id) ?? null);
}
export { emptyProject };
