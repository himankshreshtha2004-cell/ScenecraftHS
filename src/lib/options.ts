// Option lists for every dropdown, plus the plain-language phrase each one adds to a prompt.

export interface Opt { value: string; label: string; hint?: string; phrase: string }

const o = (value: string, hint: string, phrase: string): Opt => ({ value, label: value, hint, phrase });

export const FRAMINGS: Opt[] = [
  o("Extreme Wide Shot", "Shows the whole world; people are tiny", "extreme wide shot"),
  o("Wide Shot", "Whole body and surroundings", "wide shot"),
  o("Medium Shot", "Waist up — natural conversation framing", "medium shot"),
  o("Close-Up", "Face or object fills the frame", "close-up"),
  o("Extreme Close-Up", "A detail: eyes, hands, a screen", "extreme close-up"),
  o("Over-the-Shoulder", "Looking past one person at another", "over-the-shoulder shot"),
  o("POV", "We see through the character's eyes", "point-of-view shot"),
];

export const MOVEMENTS: Opt[] = [
  o("Static", "Camera does not move", "The camera holds perfectly still."),
  o("Dolly In", "Camera glides closer", "The camera slowly dollies in toward the subject."),
  o("Dolly Out", "Camera glides away", "The camera slowly dollies back, revealing more of the space."),
  o("Pan Left", "Camera turns left", "The camera pans smoothly to the left."),
  o("Pan Right", "Camera turns right", "The camera pans smoothly to the right."),
  o("Tilt Up", "Camera tilts upward", "The camera tilts upward."),
  o("Tilt Down", "Camera tilts downward", "The camera tilts downward."),
  o("Tracking Shot", "Camera follows the subject", "The camera tracks alongside the subject as they move."),
  o("Orbit", "Camera circles the subject", "The camera orbits slowly around the subject."),
  o("Crane", "Camera rises or descends", "The camera rises on a smooth crane move."),
  o("Handheld", "Natural, slightly shaky", "Subtle handheld camera movement adds tension and realism."),
];

export const LIGHTINGS: Opt[] = [
  o("Natural Daylight", "Soft, even daylight", "natural daylight"),
  o("Golden Hour", "Warm low sun", "warm golden-hour light"),
  o("Sunset", "Orange and pink sky", "sunset light"),
  o("Moonlight", "Cool, silvery night light", "cool moonlight"),
  o("Soft Studio Lighting", "Clean and flattering", "soft studio lighting"),
  o("Dramatic Low-Key", "Deep shadows, strong contrast", "dramatic low-key lighting with deep shadows"),
  o("Neon Night", "Coloured signs and reflections", "neon night lighting with coloured reflections"),
  o("Pre-Dawn", "Blue hour turning warm", "pre-dawn blue-hour light warming at the horizon"),
];

export const MOODS: Opt[] = [
  o("Peaceful", "", "peaceful"), o("Dramatic", "", "dramatic"), o("Mysterious", "", "mysterious"),
  o("Romantic", "", "romantic"), o("Intense", "", "intense"), o("Melancholic", "", "melancholic"),
  o("Hopeful", "", "hopeful"), o("Tense", "", "tense"),
];

export const TIMES = ["Dawn", "Morning", "Midday", "Afternoon", "Golden Hour", "Dusk", "Night", "Midnight"];

export const GENRES = ["Mystery", "Thriller", "Drama", "Fantasy", "Science Fiction", "Romance", "Adventure", "Documentary", "Neo-Noir Mystery"];
export const FILM_STYLES = ["Cinematic Realism", "Anime", "Stylized 3D", "Film Noir", "Vintage Film"];
export const DURATIONS = [{ v: 15, l: "15 sec" }, { v: 30, l: "30 sec" }, { v: 60, l: "60 sec" }, { v: 120, l: "2 min" }];
export const ASPECTS = ["16:9", "9:16", "1:1", "2.39:1"] as const;

export const phrase = (list: Opt[], value: string) => list.find((x) => x.value === value)?.phrase ?? value.toLowerCase();

/** which lighting choices make sense for which time of day — used by the continuity checker */
export const NIGHT_TIMES = ["Night", "Midnight"];
export const DAY_ONLY_LIGHTING = ["Natural Daylight", "Golden Hour", "Sunset"];

export const aspectRatio = (a: string) => {
  const [w, h] = a.split(":").map(Number);
  return w / h;
};
