// SceneCraft data model. Every record has a stable id; relationships are by id.

export type Aspect = "16:9" | "9:16" | "1:1" | "2.39:1";
export type ShotStatus = "draft" | "review" | "approved";
export type Complexity = "simple" | "balanced" | "cinematic";

/** A binary image stored in IndexedDB (blob lives in the `assets` table, this is its metadata). */
export interface Asset {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  createdAt: number;
  /** where it came from — "sample" assets are illustrations shipped with the demo project */
  origin: "upload" | "sample" | "generated";
  /** free tags, e.g. "storyboard", "character", "location", "frame" */
  tags: string[];
}

export interface Scene {
  id: string;
  title: string;
  summary: string;
}

export interface Wardrobe {
  id: string;
  name: string;
  clothes: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
  face: string;
  hair: string;
  accessories: string;
  wardrobes: Wardrobe[];
  /** the wardrobe that is "locked" as the established look */
  lockedWardrobeId: string;
  refAssetIds: string[];
  locked: boolean;
}

export interface LocationVariant {
  id: string;
  name: string; // e.g. "Rainy Night"
  lighting: string;
  weather: string;
}

export interface Location {
  id: string;
  name: string;
  architecture: string;
  description: string;
  objects: string;
  materials: string;
  palette: string;
  lighting: string;
  variants: LocationVariant[];
  refAssetIds: string[];
  locked: boolean;
}

export interface StyleProfile {
  locked: boolean;
  visualStyle: string;
  palette: string;
  cameraLanguage: string;
  lighting: string;
  grain: "none" | "subtle" | "medium" | "heavy";
  contrast: "low" | "medium" | "high";
  atmosphere: string;
}

export interface PromptVersion {
  id: string;
  label: string;
  text: string;
  createdAt: number;
}

export interface ShotCharacter {
  characterId: string;
  /** wardrobe used in this shot (defaults to the character's locked wardrobe) */
  wardrobeId: string;
}

export interface Shot {
  id: string;
  sceneId: string;
  title: string;
  description: string;
  duration: number; // seconds
  framing: string;
  movement: string;
  lighting: string;
  mood: string;
  timeOfDay: string;
  motion: string;
  characters: ShotCharacter[];
  locationId: string | null;
  locationVariantId: string | null;
  /** per-shot deviation from the locked location's architecture (empty = none) */
  architectureOverride: string;
  /** per-shot style overrides while Style Lock is on (empty fields = none) */
  styleOverride: { visualStyle?: string; palette?: string; lighting?: string };
  /** storyboard image versions (asset ids) and the preferred one */
  imageIds: string[];
  imageId: string | null;
  startFrameId: string | null;
  endFrameId: string | null;
  /** set when the start frame was taken from the previous shot's end frame */
  startFromShotId: string | null;
  frameNotes: string;
  /** the editable video prompt; null = follow the structured prompt automatically */
  promptText: string | null;
  promptVersions: PromptVersion[];
  status: ShotStatus;
  notes: string;
  /** continuity warnings the user marked as intentional */
  acknowledged: string[];
}

export interface CreditSettings {
  provider: string;
  preset: string;
  mode: "per-attempt" | "per-second";
  credits: number; // credits per attempt or per second of video
  attemptsWithout: number;
  attemptsWith: number;
  maxClip: number; // seconds per generation
  /** always true for the built-in presets: numbers are illustrative, entered by the user */
  userEntered: boolean;
}

export interface ProjectUI {
  view: View;
  selectedShotId: string | null;
  boardMode: "storyboard" | "timeline";
  selectedCharacterId: string | null;
  selectedLocationId: string | null;
}

export type View =
  | "studio" | "projects" | "story" | "storyboard" | "shot" | "characters" | "locations" | "prompts" | "credits" | "export";

export interface Project {
  id: string;
  title: string;
  concept: string;
  logline: string;
  genre: string;
  filmStyle: string;
  aspect: Aspect;
  targetDuration: number;
  complexity: Complexity;
  /** true for the bundled demo: its pictures are labelled sample illustrations */
  isSample: boolean;
  coverAssetId: string | null;
  scenes: Scene[];
  shots: Shot[];
  characters: Character[];
  locations: Location[];
  style: StyleProfile;
  credits: CreditSettings;
  assets: Asset[];
  ui: ProjectUI;
  createdAt: number;
  updatedAt: number;
  version: 1;
}

export interface ProjectMeta {
  id: string;
  title: string;
  genre: string;
  coverAssetId: string | null;
  scenes: number;
  shots: number;
  duration: number;
  readiness: number; // 0..1
  isSample: boolean;
  updatedAt: number;
  aspect: Aspect;
}
