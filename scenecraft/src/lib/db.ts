import Dexie, { type Table } from "dexie";
import type { Project } from "./types";

export interface ProjectRow { id: string; updatedAt: number; data: Project }
export interface AssetRow { id: string; projectId: string; blob: Blob }

class SceneCraftDB extends Dexie {
  projects!: Table<ProjectRow, string>;
  assets!: Table<AssetRow, string>;
  constructor() {
    super("scenecraft");
    this.version(1).stores({ projects: "id, updatedAt", assets: "id, projectId" });
  }
}

export const db = new SceneCraftDB();

export async function saveProject(p: Project) {
  await db.projects.put({ id: p.id, updatedAt: p.updatedAt, data: p });
}
export async function loadProjects(): Promise<Project[]> {
  const rows = await db.projects.toArray();
  return rows.map((r) => r.data).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function loadProject(id: string) {
  return (await db.projects.get(id))?.data ?? null;
}
export async function deleteProjectData(id: string) {
  await db.transaction("rw", db.projects, db.assets, async () => {
    await db.projects.delete(id);
    await db.assets.where("projectId").equals(id).delete();
  });
}
export async function putAsset(id: string, projectId: string, blob: Blob) {
  await db.assets.put({ id, projectId, blob });
}
export async function getAsset(id: string) {
  return (await db.assets.get(id))?.blob ?? null;
}
export async function getProjectAssets(projectId: string) {
  return db.assets.where("projectId").equals(projectId).toArray();
}
export async function deleteAssets(ids: string[]) {
  await db.assets.bulkDelete(ids);
}
