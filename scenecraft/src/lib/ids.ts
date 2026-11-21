export const uid = (p = "") => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const pad = (n: number) => String(n).padStart(2, "0");
export const fmtDur = (s: number) => {
  s = Math.round(s);
  return s >= 60 ? `${Math.floor(s / 60)}:${pad(s % 60)}` : `0:${pad(s)}`;
};
export const fmtLong = (s: number) => {
  s = Math.round(s);
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m} min ${r} sec` : `${m} min`;
};
export const ago = (t: number) => {
  const d = (Date.now() - t) / 1000;
  if (d < 45) return "just now";
  if (d < 3600) return `${Math.round(d / 60)} min ago`;
  if (d < 86400) return `${Math.round(d / 3600)} h ago`;
  if (d < 86400 * 7) return `${Math.round(d / 86400)} d ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
export const slug = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "FILM";
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
