import { create } from "zustand";
import { getAsset, getProjectAssets, putAsset } from "./db";
import { uid } from "./ids";
import type { Asset } from "./types";

/** object URLs for stored image blobs, keyed by asset id */
export const useAssetUrls = create<{ urls: Record<string, string> }>(() => ({ urls: {} }));
const blobs = new Map<string, Blob>();

function remember(id: string, blob: Blob) {
  blobs.set(id, blob);
  const old = useAssetUrls.getState().urls[id];
  if (old) return old;
  const url = URL.createObjectURL(blob);
  useAssetUrls.setState((s) => ({ urls: { ...s.urls, [id]: url } }));
  return url;
}

export async function loadAssetsFor(projectId: string) {
  const rows = await getProjectAssets(projectId);
  const urls: Record<string, string> = {};
  for (const r of rows) {
    if (useAssetUrls.getState().urls[r.id]) continue;
    blobs.set(r.id, r.blob);
    urls[r.id] = URL.createObjectURL(r.blob);
  }
  if (Object.keys(urls).length) useAssetUrls.setState((s) => ({ urls: { ...s.urls, ...urls } }));
}

export async function blobOf(id: string): Promise<Blob | null> {
  const b = blobs.get(id);
  if (b) return b;
  const d = await getAsset(id);
  if (d) remember(id, d);
  return d;
}

export async function storeBlob(projectId: string, blob: Blob, meta: Omit<Asset, "id" | "createdAt">): Promise<Asset> {
  const asset: Asset = { ...meta, id: uid("a_"), createdAt: Date.now() };
  await putAsset(asset.id, projectId, blob);
  remember(asset.id, blob);
  return asset;
}

/** reads an uploaded image, shrinks very large pictures, and returns a blob ready to store */
export async function prepareImage(file: File): Promise<{ blob: Blob; width: number; height: number; mime: string }> {
  if (!file.type.startsWith("image/")) throw new Error(`“${file.name}” is not an image.`);
  if (file.size > 40 * 1024 * 1024) throw new Error(`“${file.name}” is larger than 40 MB.`);
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { throw new Error(`Couldn't read “${file.name}”. Try a JPG, PNG or WebP image.`); }
  const max = 2000, w0 = bmp.width, h0 = bmp.height;
  const k = Math.min(1, max / Math.max(w0, h0));
  if (k === 1 && file.size < 3.5 * 1024 * 1024 && /jpeg|png|webp/.test(file.type)) {
    bmp.close?.();
    return { blob: file, width: w0, height: h0, mime: file.type };
  }
  const w = Math.round(w0 * k), h = Math.round(h0 * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob: Blob = await new Promise((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error("Couldn't process the image."))), "image/jpeg", 0.88));
  return { blob, width: w, height: h, mime: "image/jpeg" };
}

/** rasterises any stored image (including SVG illustrations) to JPEG for the PDF / ZIP */
export async function rasterize(id: string, maxW = 1600): Promise<{ bytes: Uint8Array; w: number; h: number; mime: string } | null> {
  const blob = await blobOf(id);
  if (!blob) return null;
  if (blob.type === "image/jpeg") {
    const bmp = await createImageBitmap(blob).catch(() => null);
    const w = bmp?.width ?? 0, h = bmp?.height ?? 0; bmp?.close?.();
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h, mime: "image/jpeg" };
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
    const nw = img.naturalWidth || 1600, nh = img.naturalHeight || 900;
    const k = Math.min(1, maxW / nw);
    const c = document.createElement("canvas"); c.width = Math.round(nw * k); c.height = Math.round(nh * k);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#101116"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const out: Blob = await new Promise((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error("encode"))), "image/jpeg", 0.9));
    return { bytes: new Uint8Array(await out.arrayBuffer()), w: c.width, h: c.height, mime: "image/jpeg" };
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

export const extOf = (mime: string) => (mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("svg") ? "svg" : "jpg");
