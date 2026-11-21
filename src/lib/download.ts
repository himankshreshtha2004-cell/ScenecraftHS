/** saves a file: through the hosting app's download capability when available, otherwise a normal browser download */
export async function download(blob: Blob, name: string) {
  const w = window as any;
  try {
    if (w.claude?.use) { const dl = await w.claude.use("downloads"); if (dl?.save) { await dl.save({ filename: name, data: blob }); return; } }
  } catch { /* fall back to a normal download */ }
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

export async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}
