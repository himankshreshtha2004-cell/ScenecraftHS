# SceneCraft — Perfect every frame before you generate

SceneCraft is an AI film pre-production studio. It turns an idea into a planned, visually consistent storyboard — shots, camera, characters, locations, prompts, start/end frames and a credit estimate — and exports a production kit you take to Higgsfield or any AI video tool.

It is the planning workspace that comes **before** video generation. It doesn't edit or generate video.

## What works

**Projects**
- Welcome screen, My Studio dashboard and a Projects page.
- Create, open, rename, duplicate, delete, search and sort projects.
- Each project reopens exactly where you left it.
- Back up a project to a `.scenecraft.json` file and import it again.

**Create a film**
- Start from a prompt: the concept, then genre, film style, length, aspect ratio (16:9, 9:16, 1:1, 2.39:1) and shot complexity.
- With no AI connected, SceneCraft sets up correctly sized blank shots for you to fill in.

**Storyboard**
- Large shot cards grouped by scene. Each shows its image, title, description, duration, framing and camera move, status (Draft, Review or Approved), and continuity and readiness markers.
- Add, duplicate, delete, approve and reorder shots by drag-and-drop (mouse or keyboard).
- Drop or click to upload an image straight onto a card.
- Timeline view sizes each shot by its duration. Drag a shot's edge to change its length.
- A Shot inspector on the right; it can be collapsed.

**Shot editor**
- *Storyboard image:* a large preview, multiple versions, a preferred version, side-by-side compare, and picking from the project library. It also gives a still-image prompt to use in any image tool.
- *Frame planner:* start and end frames, plus **Use Previous Shot's End Frame**. The link is kept and flagged if the source frame changes. Includes a composition overlay, a rule-of-thirds grid, the motion text and camera movement.
- *Prompt:* the structured video prompt is assembled from the story, shot, characters, location, style, camera, lighting, motion and duration. You can edit it, copy it, save versions, compare versions word by word, reset it to the structured prompt and export it as .txt.
- *Readiness:* an 8-point checklist ending in READY FOR VIDEO GENERATION or NEEDS ATTENTION. Ready means the plan is complete; it doesn't guarantee how the generated video turns out.

**Locks**
- **Character DNA:** appearance, face, hair, accessories, wardrobe variations, reference images and **Character Lock**.
- **Location DNA:** architecture, description, key objects, materials, palette, lighting, lighting and weather variations, reference images and **Location Lock**.
- **Style Lock:** visual style, palette, camera language, lighting, grain, contrast and atmosphere. Individual shots can override it, and overrides are flagged.

**Continuity checker**
Rules run on the structured data. It flags:
- an outfit that differs from a locked wardrobe
- a shot that changes a locked location's architecture
- style overrides
- lighting that doesn't fit the time of day
- shots longer than one generation
- a start frame whose linked end frame has changed

Each issue offers a one-click fix or "keep as intentional". Shots show Ready, Needs Review or Conflict Detected. Images aren't analysed.

**Credit Planner**
- You enter the provider, the preset and how credits are charged (per clip or per second), plus the clip length and the attempts per shot with and without planning.
- Two comparison bars, the difference, a per-shot table and live recommendations.
- No provider prices are hard-coded. The presets are labelled "Illustrative".

**Export Production Kit**
- A review screen ("Your film is ready for production.") followed by a ZIP containing `STORYBOARD/`, `VIDEO_PROMPTS/`, `CHARACTERS/`, `LOCATIONS/`, `START_END_FRAMES/`, `SHOT_LIST.csv`, `STORYBOARD.pdf`, `PROJECT_NOTES.md` (including a manual Higgsfield workflow) and `PROJECT_DATA.json`.
- Single-file exports are also available.

**Everywhere**
- Autosave in the browser (IndexedDB) with an accurate save status.
- Undo and redo.
- An animatic **Preview** that plays the storyboard with simulated camera moves.
- Keyboard shortcuts (press `?`), reduced-motion support and settings.

**Sample project — Midnight Echo**
A six-shot neo-noir plan with locked characters, locations and style, plus one deliberate wardrobe conflict. Its pictures are **SVG sample illustrations**, labelled as such everywhere. They are not generated film stills.

## Optional AI (off unless you configure it)

`api/ai.js` is a Vercel serverless function. Set these environment variables in your Vercel project, then redeploy:

| Variable | Turns on |
| --- | --- |
| `ANTHROPIC_API_KEY` | AI storyboard proposals in **Create My Storyboard**, and the **Prompt Assistant** (suggestions you approve before they apply) |
| `ANTHROPIC_MODEL` | optional, defaults to `claude-sonnet-5-5` |
| `OPENAI_API_KEY` | **Generate** storyboard images in the shot editor |
| `OPENAI_IMAGE_MODEL` | optional, defaults to `gpt-image-1` |

Keys stay on the server. The browser only learns which features are available. Without keys, every AI button is replaced by an explanation, and the rest of the app works fully. The AI calls are implemented but were not tested against the live APIs during development.

## Run and deploy

```bash
npm install
npm run dev      # local development
npm run build    # production build in dist/
```

**Vercel:** import the repository. The Vite preset, `npm run build` and the `dist` output are detected automatically, and `api/ai.js` deploys as a function. Any static host (Netlify, GitHub Pages) also works without the AI features.

## Not included yet (future ideas)

- Real-time collaboration or cloud sync. Projects live in one browser; use backup files to move them.
- Direct, one-click sending to Higgsfield. No official integration is assumed; the kit and notes describe the manual upload.
- Image analysis for continuity (the checks are rule-based on your settings).
- Mobile layouts below about 1000 px wide.

## Stack

React 18, TypeScript, Vite, Tailwind CSS, Lucide icons, Framer Motion, Zustand, dnd-kit, Dexie (IndexedDB), JSZip, jsPDF.
