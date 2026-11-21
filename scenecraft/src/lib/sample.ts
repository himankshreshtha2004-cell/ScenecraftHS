import { artApartment, artCity, artDistrict, artElara, artEncounter, artMessage, artNewLead, artReturn, artRevelation, svgBlob } from "./art";
import { storeBlob } from "./assets";
import { uid } from "./ids";
import type { Asset, Complexity, CreditSettings, Project, Scene, Shot, StyleProfile } from "./types";

export const defaultStyle = (filmStyle = "Cinematic Realism"): StyleProfile => ({
  locked: false, visualStyle: filmStyle, palette: "", cameraLanguage: "", lighting: "", grain: "subtle", contrast: "medium", atmosphere: "",
});

export const defaultCredits = (): CreditSettings => ({
  provider: "Higgsfield", preset: "My plan (enter your numbers)", mode: "per-attempt", credits: 70,
  attemptsWithout: 3, attemptsWith: 2, maxClip: 10, userEntered: true,
});

export function newShot(sceneId: string, n: number, partial: Partial<Shot> = {}): Shot {
  return {
    id: uid("s_"), sceneId, title: `Shot ${n}`, description: "", duration: 5, framing: "Medium Shot", movement: "Static",
    lighting: "Natural Daylight", mood: "Dramatic", timeOfDay: "Afternoon", motion: "", characters: [], locationId: null,
    locationVariantId: null, architectureOverride: "", styleOverride: {}, imageIds: [], imageId: null, startFrameId: null,
    endFrameId: null, startFromShotId: null, frameNotes: "", promptText: null, promptVersions: [], status: "draft", notes: "",
    acknowledged: [], dialogue: [], sound: "", generated: false, resultUrl: "", ...partial,
  };
}

export function emptyProject(o: { title: string; concept: string; genre: string; filmStyle: string; aspect: Project["aspect"]; targetDuration: number; complexity: Complexity; shotCount?: number }): Project {
  const now = Date.now();
  const scene: Scene = { id: uid("sc_"), title: "Scene 1", summary: "" };
  // a blank shot scaffold sized to the chosen length — titles and descriptions are left for the filmmaker
  const per = o.complexity === "simple" ? 8 : o.complexity === "balanced" ? 6 : 4;
  const count = o.shotCount ? Math.max(1, Math.min(40, o.shotCount)) : Math.max(3, Math.min(24, Math.round(o.targetDuration / per)));
  const each = Math.max(2, Math.round(o.targetDuration / count));
  const shots = Array.from({ length: count }, (_, i) => newShot(scene.id, i + 1, { duration: each }));
  return {
    id: uid("p_"), title: o.title || "Untitled film", concept: o.concept, logline: "", genre: o.genre, filmStyle: o.filmStyle, aspect: o.aspect,
    targetDuration: o.targetDuration, complexity: o.complexity, isSample: false, coverAssetId: null, scenes: [scene], shots, characters: [],
    locations: [], style: defaultStyle(o.filmStyle), credits: defaultCredits(), assets: [],
    ui: { view: "storyboard", selectedShotId: shots[0]?.id ?? null, boardMode: "storyboard", selectedCharacterId: null, selectedLocationId: null },
    createdAt: now, updatedAt: now, version: 1,
  };
}

/** fills in fields added in later versions so older saved projects keep working */
export function normalizeProject(p: Project): Project {
  p.shots = p.shots.map((s) => ({ ...({ dialogue: [], sound: "", generated: false, resultUrl: "" } as Partial<Shot>), ...s }) as Shot);
  p.ui = { promptTarget: "higgsfield", ...p.ui };
  return p;
}

/** Builds the bundled demo, "Midnight Echo". Its pictures are SVG sample illustrations, labelled as such. */
export async function createSampleProject(): Promise<Project> {
  const pid = uid("p_");
  const assets: Asset[] = [];
  const add = async (name: string, svg: string, tags: string[], w = 1600, h = 900) => {
    const a = await storeBlob(pid, svgBlob(svg), { name: `Sample illustration — ${name}`, mime: "image/svg+xml", width: w, height: h, origin: "sample", tags });
    assets.push(a);
    return a.id;
  };
  const city = await add("The City", artCity(), ["storyboard"]);
  const ret = await add("The Return (far)", artReturn("far"), ["storyboard", "frame"]);
  const retNear = await add("The Return (near)", artReturn("near"), ["storyboard", "frame"]);
  const msg = await add("The Message", artMessage(true), ["storyboard", "frame"]);
  const msgDark = await add("The Message (screen off)", artMessage(false), ["storyboard", "frame"]);
  const enc = await add("The Encounter", artEncounter(), ["storyboard"]);
  const rev = await add("The Revelation", artRevelation(), ["storyboard"]);
  const lead = await add("A New Lead", artNewLead(), ["storyboard"]);
  const elara = await add("Elara reference", artElara(), ["character"], 900, 1200);
  const district = await add("Old Riverside District", artDistrict(), ["location"]);
  const apt = await add("Elara's Apartment", artApartment(), ["location"]);

  const s1: Scene = { id: uid("sc_"), title: "Return to Riverside", summary: "Elara comes back to the district she left behind." };
  const s2: Scene = { id: uid("sc_"), title: "What the Past Knows", summary: "A stranger and a wall of clues point her toward the truth." };

  const coat = uid("w_"), jacket = uid("w_"), suit = uid("w_"), over = uid("w_");
  const elaraC = {
    id: uid("c_"), name: "Elara", role: "Lead — former detective",
    description: "a woman in her early thirties with a guarded, watchful presence",
    face: "sharp cheekbones, dark expressive eyes, a thin scar above the left eyebrow",
    hair: "dark shoulder-length hair, tied loosely at the back",
    accessories: "a worn silver wristwatch",
    wardrobes: [
      { id: coat, name: "Long brown coat", clothes: "a long brown wool coat over a dark knit sweater, black trousers and ankle boots" },
      { id: jacket, name: "Rain jacket", clothes: "a short black rain jacket with the hood down" },
      { id: suit, name: "Detective's grey suit", clothes: "a charcoal grey suit with a white shirt" },
    ],
    lockedWardrobeId: coat, refAssetIds: [elara], locked: true,
  };
  const stranger = {
    id: uid("c_"), name: "The Stranger", role: "Figure from her past", description: "a tall man whose face stays in shadow",
    face: "", hair: "", accessories: "", wardrobes: [{ id: over, name: "Dark overcoat", clothes: "a dark overcoat and a brimmed hat" }],
    lockedWardrobeId: over, refAssetIds: [], locked: false,
  };

  const rainyNight = uid("v_"), midnight = uid("v_"), preDawn = uid("v_"), aptNight = uid("v_");
  const riverside = {
    id: uid("l_"), name: "Old Riverside District",
    architecture: "narrow streets of old four-storey brick buildings with iron fire escapes",
    description: "a narrow city street by the river, lined with neon shop signs, wet roads and warm window lighting",
    objects: "a pink noodle-bar sign, a blue pharmacy cross, overflowing gutters, parked scooters",
    materials: "red brick, wet asphalt, rusted iron, fogged glass", palette: "navy, amber, magenta and cyan neon",
    lighting: "neon signage and warm windows", refAssetIds: [district], locked: true,
    variants: [
      { id: rainyNight, name: "Rainy Night", lighting: "neon reflections on wet asphalt", weather: "steady rain" },
      { id: midnight, name: "Midnight", lighting: "sparse street lamps, most signs switched off", weather: "light drizzle" },
      { id: preDawn, name: "Pre-Dawn", lighting: "blue hour turning warm at the horizon", weather: "rain clearing, low mist" },
    ],
  };
  const apartment = {
    id: uid("l_"), name: "Elara's Apartment",
    architecture: "a small top-floor flat with a tall steel-framed window facing the district",
    description: "a sparse, dim apartment with a wooden table by the window and a wall pinned with case photographs",
    objects: "a wooden table, a desk lamp, a corkboard of photographs joined with red string", materials: "worn wood, plaster, steel window frame",
    palette: "dark browns, amber lamp light, neon bleeding through the window", lighting: "a single warm desk lamp", refAssetIds: [apt], locked: true,
    variants: [{ id: aptNight, name: "Night, rain outside", lighting: "warm lamp light, neon through the glass", weather: "rain streaking the window" }],
  };
  const alley = {
    id: uid("l_"), name: "Back Alley", architecture: "a narrow service alley between brick walls", description: "a dim alley behind the noodle bar, lit by a single caged lamp",
    objects: "bins, a dripping drainpipe, a fire door", materials: "brick, wet concrete", palette: "near-black with one warm pool of light", lighting: "one caged bulb",
    refAssetIds: [], locked: false, variants: [],
  };

  const ch = (c: typeof elaraC | typeof stranger, w?: string) => ({ characterId: c.id, wardrobeId: w ?? c.lockedWardrobeId });
  const shots: Shot[] = [
    newShot(s1.id, 1, {
      title: "The City", description: "Wide establishing shot of a rain-soaked city at night, neon reflections shimmering on the empty streets below.",
      duration: 8, framing: "Extreme Wide Shot", movement: "Crane", lighting: "Neon Night", mood: "Mysterious", timeOfDay: "Night",
      motion: "Rain falls steadily; distant traffic lights blink; the camera slowly descends toward the river district.",
      locationId: riverside.id, locationVariantId: rainyNight, imageIds: [city], imageId: city, startFrameId: city, endFrameId: ret,
      frameNotes: "End on the street where Elara will appear so Shot 02 can start from the same view.", status: "approved",
    }),
    newShot(s1.id, 2, {
      title: "The Return", description: "Elara walks through the old district, surrounded by neon reflections, looking up at buildings she hasn't seen in years.",
      duration: 10, framing: "Wide Shot", movement: "Tracking Shot", lighting: "Neon Night", mood: "Melancholic", timeOfDay: "Night",
      motion: "Elara walks toward camera from deep in the street; her coat moves with each step; neon signs flicker in puddles.",
      characters: [ch(elaraC)], locationId: riverside.id, locationVariantId: rainyNight, imageIds: [ret, retNear], imageId: ret,
      startFrameId: ret, endFrameId: retNear, frameNotes: "Starts from Shot 01's end frame.", status: "approved",
    }),
    newShot(s1.id, 3, {
      title: "The Message", description: "Close-up of Elara's phone on the apartment table as a mysterious voice message plays, the waveform pulsing on the screen.",
      duration: 6, framing: "Close-Up", movement: "Dolly In", lighting: "Dramatic Low-Key", mood: "Tense", timeOfDay: "Night",
      motion: "The screen lights up and the waveform pulses with the voice; raindrops streak the window behind; the camera pushes in slowly.",
      characters: [ch(elaraC)], locationId: apartment.id, locationVariantId: aptNight, imageIds: [msg, msgDark], imageId: msg,
      startFrameId: msgDark, endFrameId: msg, frameNotes: "Screen off → screen lit with the waveform.", status: "review",
      notes: "Focus on the voice message as the turning point. Keep Elara's presence implied (a hand, or over-the-shoulder).",
    }),
    newShot(s2.id, 4, {
      title: "The Encounter", description: "Elara faces a shadowy figure under the only lamp in a dim alley; neither moves first.",
      duration: 7, framing: "Over-the-Shoulder", movement: "Handheld", lighting: "Dramatic Low-Key", mood: "Intense", timeOfDay: "Midnight",
      motion: "The figure takes one step forward into the light; rain drips from the lamp cage; slight handheld drift.",
      characters: [ch(elaraC, jacket), ch(stranger)], locationId: alley.id, imageIds: [enc], imageId: enc, startFrameId: enc, status: "draft",
    }),
    newShot(s2.id, 5, {
      title: "The Revelation", description: "Photographs and clues pinned on the apartment wall connect with red string, revealing a link to Elara's past.",
      duration: 9, framing: "Medium Shot", movement: "Pan Right", lighting: "Dramatic Low-Key", mood: "Mysterious", timeOfDay: "Night",
      motion: "The camera pans across the pinned photographs, settling on one face circled in red.",
      locationId: apartment.id, locationVariantId: aptNight, imageIds: [rev], imageId: rev, status: "draft",
    }),
    newShot(s2.id, 6, {
      title: "A New Lead", description: "Elara stands on a rooftop above the district and looks toward the horizon as daylight begins to break.",
      duration: 10, framing: "Wide Shot", movement: "Dolly Out", lighting: "Pre-Dawn", mood: "Hopeful", timeOfDay: "Dawn",
      motion: "Wind moves her coat; the sky warms from blue to amber; the camera pulls back to reveal the city.",
      characters: [ch(elaraC)], locationId: riverside.id, locationVariantId: preDawn, imageIds: [lead], imageId: lead, startFrameId: lead, status: "review",
    }),
  ];
  shots[1].startFromShotId = shots[0].id;
  const L = (speaker: string, line: string, delivery = "") => ({ id: uid("d_"), speaker, line, delivery });
  shots[0].dialogue = [L(elaraC.id, "Some cities forget you. This one never did.", "V.O., tired")];
  shots[0].sound = "steady rain, distant traffic, a low synth drone";
  shots[1].sound = "footsteps on wet asphalt, buzzing neon signs";
  shots[2].dialogue = [L("Voice on the phone", "Elara… it's me. You were right about the river. Come home.", "distorted, over the phone")];
  shots[2].sound = "rain against the window, a faint electrical hiss";
  shots[3].dialogue = [L(stranger.id, "You shouldn't have come back, detective.", "low and calm"), L(elaraC.id, "Then you shouldn't have called.", "steady")];
  shots[3].sound = "dripping water, a distant siren";
  shots[4].dialogue = [L(elaraC.id, "Every face on this wall was a promise I couldn't keep.", "V.O.")];
  shots[4].sound = "a clock ticking, rain easing off";
  shots[5].dialogue = [L(elaraC.id, "Okay. Let's finish it.", "quietly, to herself")];
  shots[5].sound = "wind, first birds, the city waking up";
  const now = Date.now();
  const p: Project = {
    id: pid, title: "Midnight Echo",
    concept: "A former detective returns to her old neighborhood after receiving a mysterious voice message from someone she believed was gone.",
    logline: "One voice message pulls a retired detective back into the district — and the case — she swore she'd left behind.",
    genre: "Neo-Noir Mystery", filmStyle: "Cinematic Realism", aspect: "16:9", targetDuration: 60, complexity: "cinematic", isSample: true,
    coverAssetId: ret, scenes: [s1, s2], shots, characters: [elaraC, stranger], locations: [riverside, apartment, alley],
    style: {
      locked: true, visualStyle: "neo-noir cinematic realism", palette: "deep navy and teal shadows, warm amber practicals, magenta and cyan neon accents",
      cameraLanguage: "slow deliberate moves, shallow depth of field, anamorphic feel", lighting: "motivated practical light with strong contrast",
      grain: "subtle", contrast: "high", atmosphere: "rain-soaked, quiet and melancholic",
    },
    credits: defaultCredits(), assets,
    ui: { view: "storyboard", selectedShotId: shots[2].id, boardMode: "storyboard", selectedCharacterId: elaraC.id, selectedLocationId: riverside.id },
    createdAt: now, updatedAt: now, version: 1,
  };
  p.shots[2].promptVersions = [{ id: uid("pv_"), label: "First draft", createdAt: now - 3600_000, text: "Close-up of a phone on a table, a voice message playing, rain on the window, moody lighting." }];
  return p;
}
