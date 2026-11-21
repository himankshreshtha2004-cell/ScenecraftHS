import { Images, MapPin, Plus, Star, Trash2, Upload, User, Users, X } from "lucide-react";
import { useState } from "react";
import { LibraryPicker } from "../components/Library";
import { AssetImg, Button, Card, confirmDialog, cx, Empty, Field, FileButton, IconButton, Input, LockToggle, Pill, SectionTitle, TextArea } from "../components/ui";
import { uid, pad } from "../lib/ids";
import { buildVideoPrompt } from "../lib/prompt";
import type { Character, Location, Project } from "../lib/types";
import { useStore } from "../store/store";

function RefImages({ p, ids, onAdd, onRemove, kind }: { p: Project; ids: string[]; onAdd: (ids: string[]) => void; onRemove: (id: string) => void; kind: "character" | "location" }) {
  const st = useStore.getState();
  const [lib, setLib] = useState(false);
  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5">
        {ids.map((id, i) => (
          <div key={id} className="relative group">
            <AssetImg id={id} assets={p.assets} aspect={kind === "character" ? "1:1" : "16:9"} className="rounded-xl" />
            {i === 0 && <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold flex items-center gap-1"><Star className="h-2.5 w-2.5 fill-amber text-amber" />Main</span>}
            <button onClick={() => onRemove(id)} aria-label="Remove reference" className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-panel border border-line grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 text-mute hover:text-bad"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <FileButton size="sm" multiple icon={<Upload className="h-4 w-4" />} onFiles={async (f) => { const a = await st.addImages(f, [kind]); if (a.length) { onAdd(a.map((x) => x.id)); st.toast("Reference added.", "ok"); } }}>Upload reference</FileButton>
        <Button size="sm" icon={<Images className="h-4 w-4" />} onClick={() => setLib(true)}>From library</Button>
      </div>
      <LibraryPicker p={p} open={lib} onClose={() => setLib(false)} onPick={(id) => onAdd([id])} title="Choose a reference image" />
    </div>
  );
}

function ShotToggles({ p, isOn, toggle, label }: { p: Project; isOn: (sid: string) => boolean; toggle: (sid: string, on: boolean) => void; label: string }) {
  return (
    <div>
      <div className="text-[12.5px] font-medium text-mute mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {p.shots.map((s, i) => {
          const on = isOn(s.id);
          return (
            <button key={s.id} aria-pressed={on} onClick={() => toggle(s.id, !on)} title={s.title}
              className={cx("h-8 px-2.5 rounded-lg border text-[12.5px] font-medium tabular-nums transition-colors", on ? "bg-amber-soft border-amber/50 text-amber" : "border-line text-mute hover:text-ink hover:border-[#4a4e5d]")}>
              {pad(i + 1)} <span className="font-normal opacity-80">{s.title.length > 14 ? s.title.slice(0, 13) + "…" : s.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ characters */
export function Characters() {
  const p = useStore((s) => s.project)!;
  const st = useStore.getState();
  const sel = p.characters.find((c) => c.id === p.ui.selectedCharacterId) ?? p.characters[0] ?? null;
  const upd = (fn: (c: Character, p: Project) => void, key?: string) => sel && st.update((d) => { const c = d.characters.find((x) => x.id === sel.id); if (c) fn(c, d); }, key ? `${key}:${sel.id}` : undefined);
  const add = () => {
    const id = uid("c_"), w = uid("w_");
    st.update((d) => { d.characters.push({ id, name: "New character", role: "", description: "", face: "", hair: "", accessories: "", wardrobes: [{ id: w, name: "Main outfit", clothes: "" }], lockedWardrobeId: w, refAssetIds: [], locked: false }); d.ui.selectedCharacterId = id; });
  };
  const usedIn = (c: Character) => p.shots.filter((s) => s.characters.some((x) => x.characterId === c.id));
  const sample = sel && usedIn(sel)[0];

  return (
    <div className="h-full overflow-y-auto thin-scroll">
      <div className="max-w-[1320px] mx-auto px-8 py-7">
        <SectionTitle eyebrow="Character DNA" title="Characters" sub="Describe each character once. With Character Lock on, their appearance and locked outfit are written into every shot prompt they appear in — and any shot that drifts is flagged."
          right={<Button tone="primary" icon={<Plus className="h-4 w-4" />} onClick={add}>New character</Button>} />
        {!p.characters.length ? (
          <Empty icon={<Users className="h-6 w-6" />} title="No characters yet" body="Create the people in your film so they look the same in every shot." action={<Button tone="primary" onClick={add} icon={<Plus className="h-4 w-4" />}>Create a character</Button>} />
        ) : (
          <div className="grid grid-cols-[280px_1fr] gap-6 mt-7 items-start">
            <div className="space-y-2.5 sticky top-0">
              {p.characters.map((c) => (
                <button key={c.id} onClick={() => st.setUI({ selectedCharacterId: c.id })} className={cx("w-full flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors", sel?.id === c.id ? "border-amber bg-white/[.04]" : "border-line bg-surface hover:border-[#4a4e5d]")}>
                  <AssetImg id={c.refAssetIds[0]} assets={p.assets} className="h-14 w-14 rounded-xl shrink-0" label={false}>{!c.refAssetIds[0] && <User className="absolute inset-0 m-auto h-6 w-6 text-faint" />}</AssetImg>
                  <span className="flex-1 min-w-0"><span className="block font-semibold truncate">{c.name}</span><span className="block text-[12.5px] text-mute truncate">{c.role || "No role yet"}</span><span className="block text-[11.5px] text-faint mt-0.5">{usedIn(c).length} {usedIn(c).length === 1 ? "shot" : "shots"}</span></span>
                  {c.locked && <Pill tone="ok">Locked</Pill>}
                </button>
              ))}
            </div>
            {sel && (
              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0 grid grid-cols-2 gap-4">
                    <Field label="Name"><Input value={sel.name} onChange={(e) => upd((c) => { c.name = e.target.value; }, "name")} /></Field>
                    <Field label="Role"><Input value={sel.role} placeholder="e.g. Lead — former detective" onChange={(e) => upd((c) => { c.role = e.target.value; }, "role")} /></Field>
                  </div>
                  <div className="pt-6 flex items-center gap-2">
                    <LockToggle kind="Character" locked={sel.locked} onChange={(v) => { upd((c) => { c.locked = v; }); st.toast(v ? `${sel.name}'s look is locked into every prompt.` : `${sel.name} unlocked.`, "ok"); }} />
                    <IconButton label="Delete character" onClick={async () => {
                      if (await confirmDialog({ title: `Delete ${sel.name}?`, body: `${sel.name} will be removed from ${usedIn(sel).length} shots. You can undo this.`, ok: "Delete", danger: true }))
                        st.update((d) => { d.characters = d.characters.filter((x) => x.id !== sel.id); d.shots.forEach((s) => { s.characters = s.characters.filter((x) => x.characterId !== sel.id); }); d.ui.selectedCharacterId = d.characters[0]?.id ?? null; });
                    }}><Trash2 className="h-4 w-4" /></IconButton>
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_300px] gap-7 mt-6">
                  <div className="space-y-4">
                    <Field label="Appearance" hint="Age, build, presence — how you'd describe them to a casting director."><TextArea minRows={2} value={sel.description} onChange={(e) => upd((c) => { c.description = e.target.value; }, "desc")} placeholder="Young woman with a guarded, watchful presence" /></Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Facial features"><TextArea minRows={2} value={sel.face} onChange={(e) => upd((c) => { c.face = e.target.value; }, "face")} placeholder="Dark expressive eyes, sharp cheekbones" /></Field>
                      <Field label="Hairstyle"><TextArea minRows={2} value={sel.hair} onChange={(e) => upd((c) => { c.hair = e.target.value; }, "hair")} placeholder="Dark hair, tied loosely" /></Field>
                    </div>
                    <Field label="Accessories"><Input value={sel.accessories} onChange={(e) => upd((c) => { c.accessories = e.target.value; }, "acc")} placeholder="A worn silver wristwatch" /></Field>
                    <div>
                      <div className="flex items-center justify-between mb-2"><span className="text-[12.5px] font-medium text-mute">Wardrobe</span>
                        <Button size="sm" tone="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => upd((c) => { c.wardrobes.push({ id: uid("w_"), name: `Outfit ${c.wardrobes.length + 1}`, clothes: "" }); })}>Add outfit</Button></div>
                      <div className="space-y-2">
                        {sel.wardrobes.map((w) => {
                          const isLocked = w.id === sel.lockedWardrobeId;
                          return (
                            <div key={w.id} className={cx("rounded-xl border p-3", isLocked ? "border-ok/40 bg-ok-soft/40" : "border-line bg-surface")}>
                              <div className="flex items-center gap-2">
                                <Input value={w.name} onChange={(e) => upd((c) => { const x = c.wardrobes.find((y) => y.id === w.id); if (x) x.name = e.target.value; }, "wn" + w.id)} className="!h-9 !w-56" aria-label="Outfit name" />
                                {isLocked ? <Pill tone="ok">Locked look</Pill> : <Button size="sm" tone="ghost" onClick={() => upd((c) => { c.lockedWardrobeId = w.id; })}>Make locked look</Button>}
                                <span className="flex-1" />
                                {!isLocked && <IconButton label="Delete outfit" className="h-8 w-8" onClick={() => upd((c, d) => { c.wardrobes = c.wardrobes.filter((y) => y.id !== w.id); d.shots.forEach((s) => s.characters.forEach((x) => { if (x.characterId === c.id && x.wardrobeId === w.id) x.wardrobeId = c.lockedWardrobeId; })); })}><Trash2 className="h-3.5 w-3.5" /></IconButton>}
                              </div>
                              <TextArea minRows={1} className="mt-2" value={w.clothes} onChange={(e) => upd((c) => { const x = c.wardrobes.find((y) => y.id === w.id); if (x) x.clothes = e.target.value; }, "wc" + w.id)} placeholder="A long brown coat over a dark sweater" aria-label={`${w.name} clothes`} />
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[12px] text-faint mt-2">Pick a different outfit for a shot in its inspector. If the character is locked, that shot is flagged so you can confirm the change is intentional.</p>
                    </div>
                    <ShotToggles p={p} label="Appears in shots" isOn={(sid) => p.shots.find((s) => s.id === sid)!.characters.some((x) => x.characterId === sel.id)}
                      toggle={(sid, on) => st.update((d) => { const s = d.shots.find((x) => x.id === sid)!; s.characters = on ? [...s.characters, { characterId: sel.id, wardrobeId: sel.lockedWardrobeId }] : s.characters.filter((x) => x.characterId !== sel.id); })} />
                  </div>
                  <div className="space-y-5">
                    <div><div className="text-[12.5px] font-medium text-mute mb-2">Reference images</div>
                      <RefImages p={p} kind="character" ids={sel.refAssetIds} onAdd={(ids) => upd((c) => { c.refAssetIds = Array.from(new Set([...c.refAssetIds, ...ids])); })} onRemove={(id) => upd((c) => { c.refAssetIds = c.refAssetIds.filter((x) => x !== id); })} /></div>
                    {sample && (
                      <div className="rounded-xl border border-line bg-surface p-3.5">
                        <div className="text-[12px] font-semibold text-mute">In the prompt for Shot {pad(p.shots.indexOf(sample) + 1)}</div>
                        <p className="text-[12.5px] text-faint mt-1.5 leading-relaxed line-clamp-[8]">{buildVideoPrompt(p, sample)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ locations */
export function Locations() {
  const p = useStore((s) => s.project)!;
  const st = useStore.getState();
  const sel = p.locations.find((c) => c.id === p.ui.selectedLocationId) ?? p.locations[0] ?? null;
  const upd = (fn: (l: Location, p: Project) => void, key?: string) => sel && st.update((d) => { const l = d.locations.find((x) => x.id === sel.id); if (l) fn(l, d); }, key ? `${key}:${sel.id}` : undefined);
  const add = () => {
    const id = uid("l_");
    st.update((d) => { d.locations.push({ id, name: "New location", architecture: "", description: "", objects: "", materials: "", palette: "", lighting: "", variants: [], refAssetIds: [], locked: false }); d.ui.selectedLocationId = id; });
  };
  const usedIn = (l: Location) => p.shots.filter((s) => s.locationId === l.id);
  return (
    <div className="h-full overflow-y-auto thin-scroll">
      <div className="max-w-[1320px] mx-auto px-8 py-7">
        <SectionTitle eyebrow="World DNA" title="Locations" sub="Define each place once — its architecture, key objects and materials. With Location Lock on, those details stay identical in every shot set there."
          right={<Button tone="primary" icon={<Plus className="h-4 w-4" />} onClick={add}>New location</Button>} />
        {!p.locations.length ? (
          <Empty icon={<MapPin className="h-6 w-6" />} title="No locations yet" body="Add the places your film happens in." action={<Button tone="primary" onClick={add} icon={<Plus className="h-4 w-4" />}>Create a location</Button>} />
        ) : (
          <div className="grid grid-cols-[300px_1fr] gap-6 mt-7 items-start">
            <div className="space-y-2.5">
              {p.locations.map((l) => (
                <button key={l.id} onClick={() => st.setUI({ selectedLocationId: l.id })} className={cx("w-full rounded-2xl border p-2.5 text-left transition-colors", sel?.id === l.id ? "border-amber bg-white/[.04]" : "border-line bg-surface hover:border-[#4a4e5d]")}>
                  <AssetImg id={l.refAssetIds[0]} assets={p.assets} aspect="16:9" className="rounded-xl" label={false}>{!l.refAssetIds[0] && <MapPin className="absolute inset-0 m-auto h-6 w-6 text-faint" />}</AssetImg>
                  <span className="flex items-center gap-2 mt-2.5 px-1"><span className="flex-1 font-semibold truncate">{l.name}</span>{l.locked && <Pill tone="ok">Locked</Pill>}</span>
                  <span className="block text-[12px] text-faint px-1 mt-0.5">{usedIn(l).length} {usedIn(l).length === 1 ? "shot" : "shots"} · {l.variants.length} {l.variants.length === 1 ? "variation" : "variations"}</span>
                </button>
              ))}
            </div>
            {sel && (
              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <Field label="Location name" className="flex-1"><Input value={sel.name} onChange={(e) => upd((l) => { l.name = e.target.value; }, "name")} /></Field>
                  <div className="pt-6 flex items-center gap-2">
                    <LockToggle kind="Location" locked={sel.locked} onChange={(v) => { upd((l) => { l.locked = v; }); st.toast(v ? `${sel.name} is locked into every prompt set there.` : `${sel.name} unlocked.`, "ok"); }} />
                    <IconButton label="Delete location" onClick={async () => {
                      if (await confirmDialog({ title: `Delete ${sel.name}?`, body: `${usedIn(sel).length} shots use it and will have no location. You can undo this.`, ok: "Delete", danger: true }))
                        st.update((d) => { d.locations = d.locations.filter((x) => x.id !== sel.id); d.shots.forEach((s) => { if (s.locationId === sel.id) { s.locationId = null; s.locationVariantId = null; s.architectureOverride = ""; } }); d.ui.selectedLocationId = d.locations[0]?.id ?? null; });
                    }}><Trash2 className="h-4 w-4" /></IconButton>
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_340px] gap-7 mt-5">
                  <div className="space-y-4">
                    <Field label="Environment description"><TextArea minRows={2} value={sel.description} onChange={(e) => upd((l) => { l.description = e.target.value; }, "desc")} placeholder="A narrow street with neon shop signs and wet roads" /></Field>
                    <Field label="Architectural style"><TextArea minRows={2} value={sel.architecture} onChange={(e) => upd((l) => { l.architecture = e.target.value; }, "arch")} placeholder="Old four-storey brick buildings with iron fire escapes" /></Field>
                    <Field label="Important background objects"><Input value={sel.objects} onChange={(e) => upd((l) => { l.objects = e.target.value; }, "obj")} placeholder="A pink noodle-bar sign, parked scooters" /></Field>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Materials"><TextArea minRows={2} value={sel.materials} onChange={(e) => upd((l) => { l.materials = e.target.value; }, "mat")} placeholder="Brick, wet asphalt" /></Field>
                      <Field label="Colour palette"><TextArea minRows={2} value={sel.palette} onChange={(e) => upd((l) => { l.palette = e.target.value; }, "pal")} placeholder="Navy, amber, neon" /></Field>
                      <Field label="Lighting"><TextArea minRows={2} value={sel.lighting} onChange={(e) => upd((l) => { l.lighting = e.target.value; }, "lig")} placeholder="Warm windows" /></Field>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2"><span className="text-[12.5px] font-medium text-mute">Lighting & weather variations</span>
                        <div className="flex gap-1">{["Morning", "Sunset", "Rainy Night", "Midnight"].filter((n) => !sel.variants.some((v) => v.name === n)).map((n) => <Button key={n} size="sm" tone="ghost" onClick={() => upd((l) => { l.variants.push({ id: uid("v_"), name: n, lighting: n === "Morning" ? "soft morning light" : n === "Sunset" ? "warm sunset light" : n === "Rainy Night" ? "neon reflections on wet ground" : "sparse street lamps", weather: n === "Rainy Night" ? "steady rain" : n === "Midnight" ? "still air" : "clear" }); })}>+ {n}</Button>)}
                          <Button size="sm" tone="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => upd((l) => { l.variants.push({ id: uid("v_"), name: "New variation", lighting: "", weather: "" }); })}>Custom</Button></div></div>
                      <div className="space-y-2">
                        {sel.variants.map((v) => (
                          <div key={v.id} className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-2 items-center rounded-xl border border-line bg-surface p-2.5">
                            <Input value={v.name} aria-label="Variation name" onChange={(e) => upd((l) => { const x = l.variants.find((y) => y.id === v.id); if (x) x.name = e.target.value; }, "vn" + v.id)} className="!h-9 font-medium" />
                            <IconButton label="Delete variation" className="h-8 w-8" onClick={() => upd((l, d) => { l.variants = l.variants.filter((y) => y.id !== v.id); d.shots.forEach((s) => { if (s.locationVariantId === v.id) s.locationVariantId = null; }); })}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                            <div className="col-span-2 grid grid-cols-2 gap-2">
                              <Input value={v.lighting} aria-label="Variation lighting" placeholder="Lighting" onChange={(e) => upd((l) => { const x = l.variants.find((y) => y.id === v.id); if (x) x.lighting = e.target.value; }, "vl" + v.id)} className="!h-9" />
                              <Input value={v.weather} aria-label="Variation weather" placeholder="Weather" onChange={(e) => upd((l) => { const x = l.variants.find((y) => y.id === v.id); if (x) x.weather = e.target.value; }, "vw" + v.id)} className="!h-9" />
                            </div>
                          </div>
                        ))}
                        {!sel.variants.length && <p className="text-[12.5px] text-faint">No variations yet — add the same place at different times or in different weather.</p>}
                      </div>
                    </div>
                    <ShotToggles p={p} label="Used in shots (click to assign)" isOn={(sid) => p.shots.find((s) => s.id === sid)!.locationId === sel.id}
                      toggle={(sid, on) => st.update((d) => { const s = d.shots.find((x) => x.id === sid)!; if (on) { s.locationId = sel.id; s.locationVariantId = null; s.architectureOverride = ""; } else if (s.locationId === sel.id) { s.locationId = null; s.locationVariantId = null; } })} />
                  </div>
                  <div><div className="text-[12.5px] font-medium text-mute mb-2">Reference images</div>
                    <RefImages p={p} kind="location" ids={sel.refAssetIds} onAdd={(ids) => upd((l) => { l.refAssetIds = Array.from(new Set([...l.refAssetIds, ...ids])); })} onRemove={(id) => upd((l) => { l.refAssetIds = l.refAssetIds.filter((x) => x !== id); })} /></div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
