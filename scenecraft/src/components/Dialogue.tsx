import { Check, Loader2, Mic, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { writeDialogue } from "../lib/ai";
import { storyContext } from "../lib/aiapply";
import { uid } from "../lib/ids";
import { updateShot } from "../lib/ops";
import { speakerName } from "../lib/prompt";
import type { DialogueLine, Project, Shot } from "../lib/types";
import { useStore } from "../store/store";
import { askText, Button, cx, Field, IconButton, Input, Select, TextArea } from "./ui";

export function DialogueEditor({ p, s }: { p: Project; s: Shot }) {
  const st = useStore.getState();
  const ai = useStore((x) => x.ai);
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState<{ dialogue: DialogueLine[]; sound: string } | null>(null);
  const words = s.dialogue.reduce((a, d) => a + d.line.split(/\s+/).filter(Boolean).length, 0);
  const tooLong = words > s.duration * 2.7;
  const free = Array.from(new Set(p.shots.flatMap((x) => x.dialogue.map((d) => d.speaker)).filter((id) => !p.characters.some((c) => c.id === id))));
  const speakers = [
    ...p.characters.filter((c) => s.characters.some((x) => x.characterId === c.id)).map((c) => ({ value: c.id, label: `${c.name} (in shot)` })),
    ...p.characters.filter((c) => !s.characters.some((x) => x.characterId === c.id)).map((c) => ({ value: c.id, label: c.name })),
    ...Array.from(new Set(["Narrator", ...free])).map((n) => ({ value: n, label: n })),
    { value: "__other", label: "Someone else…" },
  ];
  const set = (id: string, patch: Partial<DialogueLine>, key?: string) => updateShot(s.id, (x) => { const d = x.dialogue.find((y) => y.id === id); if (d) Object.assign(d, patch); }, key);
  const add = () => updateShot(s.id, (x) => { x.dialogue.push({ id: uid("d_"), speaker: x.characters[0]?.characterId ?? p.characters[0]?.id ?? "Narrator", line: "", delivery: "" }); });
  const write = async () => {
    setBusy(true); setSugg(null);
    try {
      const r = await writeDialogue(`${storyContext(p, s.id)}\n\nWrite the dialogue for the shot marked >>> (Shot ${p.shots.indexOf(s) + 1}, ${s.duration} seconds). Characters in this shot: ${s.characters.map((c) => speakerName(p, c.characterId)).join(", ") || "none"}.`);
      setSugg({
        dialogue: (r.dialogue || []).filter((d) => d.line?.trim()).map((d) => ({ id: uid("d_"), speaker: p.characters.find((c) => c.name.toLowerCase() === (d.speaker || "").toLowerCase())?.id ?? (d.speaker || "Narrator"), line: d.line.trim(), delivery: d.delivery || "" })),
        sound: r.sound || "",
      });
    } catch (e: any) { st.toast(`Couldn't write dialogue: ${e.message}`, "error"); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      {s.dialogue.map((d) => (
        <div key={d.id} className="rounded-xl border border-line bg-surface p-2.5 space-y-2">
          <div className="flex gap-2">
            <Select className="flex-1" aria-label="Speaker" value={speakers.some((o) => o.value === d.speaker) ? d.speaker : "__other"} options={speakers.some((o) => o.value === d.speaker) ? speakers : [{ value: "__other", label: d.speaker }, ...speakers]}
              onChange={async (v) => { if (v === "__other") { const n = await askText({ title: "Who's speaking?", value: "", ok: "Use" }); if (n?.trim()) set(d.id, { speaker: n.trim() }); } else set(d.id, { speaker: v }); }} />
            <IconButton label="Remove line" className="h-10 w-9" onClick={() => updateShot(s.id, (x) => { x.dialogue = x.dialogue.filter((y) => y.id !== d.id); })}><X className="h-4 w-4" /></IconButton>
          </div>
          <TextArea minRows={1} aria-label="Line" value={d.line} placeholder="What they say…" onChange={(e) => set(d.id, { line: e.target.value }, "dl" + d.id)} />
          <Input aria-label="Delivery" value={d.delivery} placeholder="How it's said — whispering, over the phone, V.O." onChange={(e) => set(d.id, { delivery: e.target.value }, "dd" + d.id)} className="!h-9 !text-[13px]" />
        </div>
      ))}
      {tooLong && <p className="text-[12px] text-warn">About {words} words — may be too much to say in {s.duration} s. Shorten the lines or lengthen the shot.</p>}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={add}>Add line</Button>
        {ai.text && <Button size="sm" tone="ai" disabled={busy} icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} onClick={write}>{busy ? "Writing…" : s.dialogue.length ? "Rewrite dialogue" : "Write dialogue"}</Button>}
      </div>
      {sugg && (
        <div className="rounded-xl border border-ai/35 bg-ai-soft/40 p-3">
          <div className="text-[12.5px] font-semibold text-ai flex items-center gap-1.5"><Mic className="h-3.5 w-3.5" />Suggested</div>
          {sugg.dialogue.length ? sugg.dialogue.map((d) => <p key={d.id} className="text-[13px] mt-1.5"><span className="font-semibold uppercase tracking-wide text-[11.5px]">{speakerName(p, d.speaker)}</span>{d.delivery && <span className="text-faint"> ({d.delivery})</span>}<br /><span className="text-ink/90">“{d.line}”</span></p>) : <p className="text-[13px] text-mute mt-1">No dialogue — this shot plays better silent.</p>}
          {sugg.sound && <p className="text-[12.5px] text-mute mt-2">Sound: {sugg.sound}</p>}
          <div className="flex gap-2 mt-3">
            <Button size="sm" tone="ai" icon={<Check className="h-4 w-4" />} onClick={() => { updateShot(s.id, (x) => { x.dialogue = sugg.dialogue; if (sugg.sound) x.sound = sugg.sound; }); setSugg(null); st.toast("Dialogue added to the shot and its prompts.", "ok"); }}>Use this</Button>
            <Button size="sm" tone="ghost" onClick={() => setSugg(null)}>Discard</Button>
          </div>
        </div>
      )}
      <Field label="Sound & music" hint="Ambience, effects or score — added to the video prompt.">
        <Input value={s.sound} placeholder="Rain on the window, a distant siren" onChange={(e) => updateShot(s.id, (x) => { x.sound = e.target.value; }, "sound")} />
      </Field>
      {!s.dialogue.length && !ai.text && <p className={cx("text-[12px] text-faint")}>Add lines by hand, or connect AI to have them written for you.</p>}
    </div>
  );
}
