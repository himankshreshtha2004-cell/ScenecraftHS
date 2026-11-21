import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { blobOf, extOf, rasterize } from "./assets";
import { continuityStatus, creditTotals, projectIssues, readiness, shotIssues, STATUS_LABEL, totalDuration } from "./checks";
import { fmtDur, pad, slug } from "./ids";
import { buildImagePrompt, dialogueLines, formatPrompt, promptOf, shotCharacters, shotLocation } from "./prompt";
import type { Project, Shot } from "./types";

export interface KitOptions { approvedOnly: boolean; script: boolean; images: boolean; prompts: boolean; characters: boolean; locations: boolean; frames: boolean; shotList: boolean; pdf: boolean; notes: boolean }
export const defaultKit = (): KitOptions => ({ approvedOnly: false, script: true, images: true, prompts: true, characters: true, locations: true, frames: true, shotList: true, pdf: true, notes: true });

const sceneNo = (p: Project, s: Shot) => p.scenes.findIndex((x) => x.id === s.sceneId) + 1;
const shotName = (p: Project, s: Shot) => `SCENE_${pad(Math.max(1, sceneNo(p, s)))}_SHOT_${pad(p.shots.indexOf(s) + 1)}_${slug(s.title)}`;
const csvCell = (v: string | number) => { const t = String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

/** image bytes for export: uploads keep their original file, SVG illustrations are converted to JPG */
async function imageFile(id: string): Promise<{ data: Uint8Array | Blob; ext: string } | null> {
  const b = await blobOf(id);
  if (!b) return null;
  if (b.type === "image/svg+xml") { const r = await rasterize(id, 1920); return r ? { data: r.bytes, ext: "jpg" } : null; }
  return { data: b, ext: extOf(b.type) };
}

export function shotListCSV(p: Project) {
  const head = ["Scene number", "Scene", "Shot number", "Shot title", "Duration (s)", "Camera angle", "Camera movement", "Lighting", "Time of day", "Characters", "Location", "Location variation", "Dialogue", "Sound", "Status", "Readiness", "Continuity"];
  const rows = p.shots.map((s, i) => {
    const { l, v } = shotLocation(p, s);
    const r = readiness(p, s);
    return [Math.max(1, sceneNo(p, s)), p.scenes[sceneNo(p, s) - 1]?.title ?? "", i + 1, s.title, s.duration, s.framing, s.movement, s.lighting, s.timeOfDay,
      shotCharacters(p, s).map(({ c, w }) => `${c.name}${w ? ` (${w.name})` : ""}`).join("; "), l?.name ?? "", v?.name ?? "",
      dialogueLines(p, s).map((d) => `${d.who}${d.how ? ` (${d.how})` : ""}: ${d.line}`).join(" / "), s.sound,
      s.status[0].toUpperCase() + s.status.slice(1), r.ready ? "Ready" : `${r.checks.filter((c) => c.ok && !c.na).length}/${r.checks.filter((c) => !c.na).length}`, STATUS_LABEL[continuityStatus(shotIssues(p, s))]];
  });
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function promptFile(p: Project, s: Shot) {
  const i = p.shots.indexOf(s);
  const { l, v } = shotLocation(p, s);
  return [
    `${p.title.toUpperCase()} — SHOT ${pad(i + 1)}: ${s.title.toUpperCase()}`,
    `Scene ${Math.max(1, sceneNo(p, s))} · ${s.duration} s · ${p.aspect} · ${s.framing} · ${s.movement} · status: ${s.status}`,
    `Characters: ${shotCharacters(p, s).map(({ c, w }) => `${c.name}${w ? ` (${w.name})` : ""}`).join(", ") || "none"}`,
    `Location: ${l ? `${l.name}${v ? ` — ${v.name}` : ""}` : "none"}`,
    `References to upload: ${[s.startFrameId && "start frame", s.endFrameId && "end frame", ...shotCharacters(p, s).filter(({ c }) => c.refAssetIds.length).map(({ c }) => `${c.name} reference`), l?.refAssetIds.length ? `${l.name} reference` : ""].filter(Boolean).join(", ") || "none"}`,
    "",
    ...(dialogueLines(p, s).length ? ["DIALOGUE", ...dialogueLines(p, s).map((d) => `${d.who.toUpperCase()}${d.how ? ` (${d.how})` : ""}: "${d.line}"`), ""] : []),
    "VIDEO PROMPT — HIGGSFIELD",
    formatPrompt(p, s, "higgsfield"),
    "",
    "VIDEO PROMPT — OPENAI SORA",
    formatPrompt(p, s, "sora"),
    "",
    "VIDEO PROMPT — FULL (any tool)",
    promptOf(p, s),
    "",
    "STILL / STORYBOARD IMAGE PROMPT",
    buildImagePrompt(p, s),
    ...(s.notes.trim() ? ["", "NOTES", s.notes.trim()] : []),
    "",
  ].join("\n");
}

export function projectNotes(p: Project) {
  const issues = projectIssues(p);
  const open = issues.filter((i) => !i.acknowledged), kept = issues.filter((i) => i.acknowledged);
  const t = creditTotals(p);
  const L: string[] = [];
  L.push(`# ${p.title} — Production notes`, "", `Exported from SceneCraft on ${new Date().toLocaleString()}.`, "");
  if (p.isSample) L.push("> This is the SceneCraft sample project. Its pictures are sample illustrations, not generated film stills.", "");
  L.push("## Concept", "", p.concept || "—", "");
  if (p.logline) L.push(`**Logline:** ${p.logline}`, "");
  L.push(`**Genre:** ${p.genre} · **Style:** ${p.filmStyle} · **Aspect:** ${p.aspect} · **Planned runtime:** ${fmtDur(totalDuration(p))} across ${p.shots.length} shots`, "");
  L.push("## Using this kit in Higgsfield or another AI video tool", "",
    "SceneCraft doesn't connect to video generators directly. For each shot:", "",
    "1. Open `VIDEO_PROMPTS/` and copy the shot's video prompt.",
    "2. In your video tool, upload the shot's start frame from `START_END_FRAMES/` (or its storyboard image from `STORYBOARD/`) as the image to animate, and the end frame too if the tool supports one.",
    "3. Upload the character and location reference images listed at the top of the prompt file (from `CHARACTERS/` and `LOCATIONS/`) wherever the tool accepts references.",
    "4. Set the clip length and aspect ratio shown in the prompt file, paste the prompt and generate.",
    "5. Generate shots in order and reuse each approved clip's last frame where the next shot continues the action.", "");
  L.push("## Visual style", "");
  const st = p.style;
  L.push(`Style Lock: **${st.locked ? "ON" : "OFF"}**`, "", `- Visual style: ${st.visualStyle || "—"}`, `- Colour palette: ${st.palette || "—"}`, `- Camera language: ${st.cameraLanguage || "—"}`,
    `- Lighting: ${st.lighting || "—"}`, `- Film grain: ${st.grain} · Contrast: ${st.contrast}`, `- Atmosphere: ${st.atmosphere || "—"}`, "");
  L.push("## Continuity rules (things that must not change)", "");
  p.characters.forEach((c) => {
    const w = c.wardrobes.find((x) => x.id === c.lockedWardrobeId);
    L.push(`- **${c.name}**${c.locked ? " (locked)" : ""}: ${[c.description, c.face, c.hair, w && `wearing ${w.clothes}`, c.accessories].filter(Boolean).join("; ")}`);
  });
  p.locations.forEach((l) => L.push(`- **${l.name}**${l.locked ? " (locked)" : ""}: ${[l.description, l.architecture, l.objects && `key objects: ${l.objects}`].filter(Boolean).join("; ")}`));
  if (!p.characters.length && !p.locations.length) L.push("- No characters or locations defined.");
  L.push("");
  L.push("## Continuity check", "", `Open issues: ${open.length}. Kept as intentional: ${kept.length}. (Checks compare structured shot data against the locks; images were not analysed.)`, "");
  open.forEach((i) => L.push(`- ⚠ Shot ${pad(i.shotNo)} — ${i.title}: ${i.message}`));
  kept.forEach((i) => L.push(`- ✓ Shot ${pad(i.shotNo)} — intentional: ${i.message}`));
  if (issues.length) L.push("");
  L.push("## Shots", "");
  p.shots.forEach((s, i) => {
    const r = readiness(p, s);
    L.push(`### ${pad(i + 1)} — ${s.title} (${s.duration} s, ${s.status})`, "", s.description || "—", "",
      `- Camera: ${s.framing}, ${s.movement}`, `- Light & mood: ${s.lighting}, ${s.timeOfDay.toLowerCase()}, ${s.mood.toLowerCase()}`,
      `- Intended motion: ${s.motion || "—"}`, ...(s.frameNotes ? [`- Frames: ${s.frameNotes}`] : []), ...(s.notes ? [`- Notes: ${s.notes}`] : []),
      `- Readiness: ${r.ready ? "ready for video generation (planning complete — the output itself isn't guaranteed)" : `needs attention — ${r.checks.filter((c) => !c.ok && !c.na).map((c) => c.label.toLowerCase()).join(", ")}`}`, "");
  });
  L.push("## Credit estimate (hypothetical)", "", `Provider: ${p.credits.provider || "—"} · Preset: ${p.credits.preset} · ${p.credits.mode === "per-attempt" ? `${p.credits.credits} credits per clip` : `${p.credits.credits} credits per second`} · clip length ${p.credits.maxClip} s`,
    "", `- Without planning (${p.credits.attemptsWithout} attempts/shot): ${t.without.toLocaleString()} credits`, `- With planning (${p.credits.attemptsWith} attempts/shot): ${t.with.toLocaleString()} credits`,
    "", "These numbers were entered by the user and are planning scenarios, not provider prices or promised savings.", "");
  return L.join("\n");
}

export function scriptMarkdown(p: Project) {
  const L: string[] = [`# ${p.title}`, ""];
  if (p.logline) L.push(`*${p.logline}*`, "");
  L.push(`${p.genre} · ${p.filmStyle} · ${p.aspect} · ${p.shots.length} shots · ${fmtDur(totalDuration(p))}`, "");
  p.scenes.forEach((sc, k) => {
    const shots = p.shots.filter((s) => s.sceneId === sc.id);
    if (!shots.length) return;
    L.push(`## Scene ${k + 1} — ${sc.title}`, "");
    if (sc.summary) L.push(`_${sc.summary}_`, "");
    shots.forEach((s) => {
      const { l } = shotLocation(p, s);
      L.push(`**SHOT ${pad(p.shots.indexOf(s) + 1)}. ${(l?.name ?? "Location TBD").toUpperCase()} — ${s.timeOfDay.toUpperCase()}** (${s.duration}s, ${s.framing.toLowerCase()}, ${s.movement.toLowerCase()})`, "");
      L.push([s.description, s.motion].filter(Boolean).join(" ") || "—", "");
      dialogueLines(p, s).forEach((d) => L.push(`> **${d.who.toUpperCase()}${d.vo ? " (V.O.)" : ""}**${d.how && !d.vo ? ` _(${d.how})_` : ""}  `, `> ${d.line}`, ""));
      if (s.sound) L.push(`SOUND: ${s.sound}`, "");
    });
  });
  return L.join("\n");
}

/* ------------------------------------------------------------------ PDF */
const ascii = (t: string) => t.replace(/[^\x00-\xFF–—‘’“”…•]/g, "");

export async function storyboardPDF(p: Project, shots: Shot[]): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, M = 14;
  const ink = [24, 24, 28] as const, mute = [110, 112, 122] as const, amber = [201, 139, 82] as const;
  const footer = (n: number) => { doc.setFontSize(8); doc.setTextColor(...mute); doc.text(ascii(`${p.title} — Storyboard`), M, H - 7); doc.text(`SceneCraft · ${n}`, W - M, H - 7, { align: "right" }); };

  // cover
  doc.setFillColor(16, 17, 22); doc.rect(0, 0, W, H, "F");
  const cover = p.coverAssetId ?? shots.find((s) => s.imageId)?.imageId;
  if (cover) { const r = await rasterize(cover, 1600); if (r) { let iw = W, ih = (W * r.h) / r.w; if (ih < H) { ih = H; iw = (H * r.w) / r.h; } doc.addImage(r.bytes, "JPEG", (W - iw) / 2, (H - ih) / 2, iw, ih); doc.setFillColor(16, 17, 22); doc.setGState(new (doc as any).GState({ opacity: 0.62 })); doc.rect(0, 0, W, H, "F"); doc.setGState(new (doc as any).GState({ opacity: 1 })); } }
  doc.setTextColor(232, 175, 121); doc.setFontSize(10); doc.text("STORYBOARD", M + 6, 40);
  doc.setTextColor(246, 244, 240); doc.setFont("times", "normal"); doc.setFontSize(46); doc.text(ascii(p.title), M + 6, 62);
  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(220, 220, 226);
  doc.text(doc.splitTextToSize(ascii(p.logline || p.concept), 170), M + 6, 76);
  doc.setFontSize(10); doc.setTextColor(180, 182, 192);
  doc.text(ascii(`${p.genre}  ·  ${p.filmStyle}  ·  ${p.aspect}  ·  ${shots.length} shots  ·  ${fmtDur(shots.reduce((a, s) => a + s.duration, 0))}`), M + 6, 112);
  if (p.isSample) doc.text("Sample project — images are sample illustrations.", M + 6, 120);
  doc.setFontSize(8); doc.text(`Exported ${new Date().toLocaleDateString()} from SceneCraft`, M + 6, H - 14);

  // shots, two per page
  const colW = (W - M * 2 - 10) / 2;
  for (let k = 0; k < shots.length; k += 2) {
    doc.addPage(); doc.setFillColor(255, 255, 255); doc.rect(0, 0, W, H, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...amber);
    doc.text(ascii(p.title.toUpperCase()), M, 11);
    for (let j = 0; j < 2; j++) {
      const s = shots[k + j]; if (!s) break;
      const x = M + j * (colW + 10), i = p.shots.indexOf(s);
      let y = 17;
      const [aw, ah] = p.aspect.split(":").map(Number);
      let iw = colW, ih = (colW * ah) / aw;
      if (ih > 82) { ih = 82; iw = (ih * aw) / ah; }
      doc.setFillColor(236, 236, 240); doc.rect(x, y, colW, ih, "F");
      if (s.imageId) { const r = await rasterize(s.imageId, 1400); if (r) doc.addImage(r.bytes, "JPEG", x + (colW - iw) / 2, y, iw, ih); }
      else { doc.setFontSize(9); doc.setTextColor(...mute); doc.text("No storyboard image yet", x + colW / 2, y + ih / 2, { align: "center" }); }
      y += ih + 7;
      doc.setFont("times", "normal"); doc.setFontSize(18); doc.setTextColor(...ink); doc.text(pad(i + 1), x, y);
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(ascii(s.title), x + 11, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...mute);
      doc.text(ascii(`${s.duration}s · ${s.status.toUpperCase()}`), x + colW, y, { align: "right" });
      y += 5.5;
      doc.setFontSize(9.5); doc.setTextColor(...ink);
      const desc = doc.splitTextToSize(ascii(s.description || "No description."), colW); doc.text(desc.slice(0, 3), x, y); y += Math.min(3, desc.length) * 4.2 + 2;
      const { l, v } = shotLocation(p, s);
      const meta: [string, string][] = [
        ["Scene", `${Math.max(1, sceneNo(p, s))} · ${p.scenes[sceneNo(p, s) - 1]?.title ?? ""}`], ["Camera", `${s.framing}, ${s.movement}`],
        ["Light", `${s.lighting}, ${s.timeOfDay}, ${s.mood}`], ["Cast", shotCharacters(p, s).map(({ c, w }) => `${c.name}${w ? ` (${w.name})` : ""}`).join(", ") || "—"],
        ["Location", l ? `${l.name}${v ? ` — ${v.name}` : ""}` : "—"], ["Motion", s.motion || "—"],
        ...(dialogueLines(p, s).length ? [["Dialogue", dialogueLines(p, s).map((d) => `${d.who}: "${d.line}"`).join("  ")] as [string, string]] : []),
      ];
      doc.setFontSize(8.5);
      for (const [a, b] of meta) {
        doc.setTextColor(...mute); doc.text(a.toUpperCase(), x, y);
        doc.setTextColor(...ink); const t = doc.splitTextToSize(ascii(b), colW - 20); doc.text(t.slice(0, 2), x + 20, y); y += Math.min(2, t.length) * 3.8 + 1.2;
      }
      y += 1.5; doc.setDrawColor(...amber); doc.setLineWidth(0.4); doc.line(x, y, x + 12, y); y += 4;
      doc.setTextColor(...mute); doc.setFontSize(7.5); doc.text("VIDEO PROMPT", x, y); y += 3.6;
      doc.setTextColor(60, 62, 70); doc.setFontSize(7.6);
      const pr = doc.splitTextToSize(ascii(promptOf(p, s)), colW);
      const room = Math.max(2, Math.floor((H - 14 - y) / 3.2));
      doc.text(pr.length > room ? [...pr.slice(0, room - 1), "… (full prompt in VIDEO_PROMPTS/)"] : pr, x, y);
    }
    footer(Math.floor(k / 2) + 2);
  }
  return doc.output("blob");
}

/* ------------------------------------------------------------------ ZIP */
export async function buildKit(p: Project, o: KitOptions, onStep?: (t: string) => void): Promise<{ blob: Blob; name: string; files: string[] }> {
  const zip = new JSZip();
  const root = `SCENECRAFT_${slug(p.title)}`;
  const f = zip.folder(root)!;
  const shots = o.approvedOnly ? p.shots.filter((s) => s.status === "approved") : p.shots;
  const files: string[] = [];
  const put = (path: string, data: any) => { f.file(path, data); files.push(path); };

  if (o.script) { onStep?.("Script"); put("SCRIPT.md", scriptMarkdown(p)); }
  if (o.images) {
    onStep?.("Storyboard images");
    for (const s of shots) {
      if (!s.imageId) continue;
      const im = await imageFile(s.imageId); if (im) put(`STORYBOARD/${shotName(p, s)}.${im.ext}`, im.data);
    }
  }
  if (o.prompts) { onStep?.("Video prompts"); for (const s of shots) put(`VIDEO_PROMPTS/SHOT_${pad(p.shots.indexOf(s) + 1)}_${slug(s.title)}.txt`, promptFile(p, s)); }
  if (o.frames) {
    onStep?.("Start and end frames");
    for (const s of shots) for (const [k, id] of [["START", s.startFrameId], ["END", s.endFrameId]] as const) {
      if (!id) continue;
      const im = await imageFile(id); if (im) put(`START_END_FRAMES/SHOT_${pad(p.shots.indexOf(s) + 1)}_${k}.${im.ext}`, im.data);
    }
  }
  if (o.characters) {
    onStep?.("Character references");
    for (const c of p.characters) {
      const d = `CHARACTERS/${slug(c.name)}`;
      put(`${d}/${slug(c.name)}.md`, [`# ${c.name}`, "", c.role && `*${c.role}*`, "", `Character Lock: ${c.locked ? "ON" : "OFF"}`, "", `- Appearance: ${c.description || "—"}`, `- Face: ${c.face || "—"}`, `- Hair: ${c.hair || "—"}`, `- Accessories: ${c.accessories || "—"}`, "", "## Wardrobe", "",
        ...c.wardrobes.map((w) => `- ${w.name}${w.id === c.lockedWardrobeId ? " (locked look)" : ""}: ${w.clothes || "—"}`), "", "## Appears in", "",
        ...p.shots.filter((s) => s.characters.some((x) => x.characterId === c.id)).map((s) => `- Shot ${pad(p.shots.indexOf(s) + 1)} — ${s.title}`), ""].filter((x) => x !== "" || true).join("\n"));
      let n = 1; for (const id of c.refAssetIds) { const im = await imageFile(id); if (im) put(`${d}/${slug(c.name)}_REF_${pad(n++)}.${im.ext}`, im.data); }
    }
  }
  if (o.locations) {
    onStep?.("Location references");
    for (const l of p.locations) {
      const d = `LOCATIONS/${slug(l.name)}`;
      put(`${d}/${slug(l.name)}.md`, [`# ${l.name}`, "", `Location Lock: ${l.locked ? "ON" : "OFF"}`, "", `- Environment: ${l.description || "—"}`, `- Architecture: ${l.architecture || "—"}`, `- Key objects: ${l.objects || "—"}`, `- Materials: ${l.materials || "—"}`, `- Palette: ${l.palette || "—"}`, `- Lighting: ${l.lighting || "—"}`,
        "", "## Variations", "", ...(l.variants.length ? l.variants.map((v) => `- ${v.name}: ${[v.lighting, v.weather].filter(Boolean).join(", ")}`) : ["- none"]), ""].join("\n"));
      let n = 1; for (const id of l.refAssetIds) { const im = await imageFile(id); if (im) put(`${d}/${slug(l.name)}_REF_${pad(n++)}.${im.ext}`, im.data); }
    }
  }
  if (o.shotList) { onStep?.("Shot list"); put("SHOT_LIST.csv", "﻿" + shotListCSV({ ...p, shots: p.shots })); }
  if (o.pdf) { onStep?.("Storyboard PDF"); put("STORYBOARD.pdf", await storyboardPDF(p, shots)); }
  if (o.notes) { onStep?.("Production notes"); put("PROJECT_NOTES.md", projectNotes(p)); }
  put("PROJECT_DATA.json", JSON.stringify({ app: "scenecraft", title: p.title, exportedAt: new Date().toISOString(), shots: shots.map((s) => ({ ...s, prompt: promptOf(p, s) })), characters: p.characters, locations: p.locations, style: p.style }, null, 2));
  onStep?.("Compressing");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { blob, name: `${root}.zip`, files };
}
