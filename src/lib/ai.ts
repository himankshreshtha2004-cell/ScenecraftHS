// Optional AI features. They only switch on when the deployment has a server function at /api/ai
// with provider keys set as environment variables (see README). Keys never reach the browser.

export interface AIStatus { checked: boolean; text: boolean; image: boolean; provider: string; imageProvider: string; error?: string }

const base = () => {
  try { return (localStorage.getItem("scenecraft.aiEndpoint") || "").trim() || "./api/ai"; } catch { return "./api/ai"; }
};

export async function checkAI(): Promise<AIStatus> {
  try {
    const r = await fetch(base() + "?status=1", { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return { checked: true, text: !!j.text, image: !!j.image, provider: j.provider || "", imageProvider: j.imageProvider || "" };
  } catch {
    return { checked: true, text: false, image: false, provider: "", imageProvider: "" };
  }
}

async function call<T>(task: string, payload: unknown): Promise<T> {
  const r = await fetch(base(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, ...(payload as object) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `The AI service answered ${r.status}.`);
  return j as T;
}

export interface ProposedShot { title: string; description: string; duration: number; framing: string; movement: string; lighting: string; mood: string; timeOfDay: string; motion: string; characters?: string[]; location?: string }
export interface ProposedBoard {
  title: string; logline: string;
  characters: { name: string; description: string; hair?: string; clothes?: string }[];
  locations: { name: string; description: string; architecture?: string }[];
  scenes: { title: string; summary: string; shots: ProposedShot[] }[];
}

export const proposeStoryboard = (input: { concept: string; genre: string; filmStyle: string; duration: number; complexity: string; aspect: string }) =>
  call<ProposedBoard>("storyboard", input);

export interface PromptSuggestion { prompt: string; summary: string; changes: Partial<Record<"framing" | "movement" | "lighting" | "mood" | "timeOfDay" | "motion", string>> }
export const assistPrompt = (input: { request: string; prompt: string; shot: Record<string, unknown>; locked: string[] }) =>
  call<PromptSuggestion>("assist", input);

export const generateImage = (input: { prompt: string; aspect: string }) => call<{ b64: string; mime: string }>("image", input);
