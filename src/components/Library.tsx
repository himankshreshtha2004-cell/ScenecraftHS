import { Images } from "lucide-react";
import { useState } from "react";
import type { Project } from "../lib/types";
import { AssetImg, cx, Empty, Modal, Segmented } from "./ui";

/** pick any image already in the project (uploads, references, frames, sample illustrations) */
export function LibraryPicker({ p, open, onClose, onPick, title = "Choose from project library" }: { p: Project; open: boolean; onClose: () => void; onPick: (id: string) => void; title?: string }) {
  const [tag, setTag] = useState<"all" | "storyboard" | "frame" | "character" | "location">("all");
  const list = p.assets.filter((a) => tag === "all" || a.tags.includes(tag)).slice().reverse();
  return (
    <Modal open={open} onClose={onClose} title={title} sub={`${p.assets.length} images in this project`} width={880}>
      <Segmented size="sm" value={tag} onChange={setTag} options={[{ value: "all", label: "All" }, { value: "storyboard", label: "Storyboard" }, { value: "frame", label: "Frames" }, { value: "character", label: "Characters" }, { value: "location", label: "Locations" }]} />
      {list.length ? (
        <div className="grid grid-cols-4 gap-3 mt-4">
          {list.map((a) => (
            <button key={a.id} onClick={() => { onPick(a.id); onClose(); }} className={cx("group text-left rounded-xl p-1.5 border border-transparent hover:border-amber/60 hover:bg-white/[.03] transition-colors")}>
              <AssetImg id={a.id} assets={p.assets} aspect="16:9" className="rounded-lg" fit={a.height > a.width ? "contain" : "cover"} />
              <div className="text-[12px] text-mute truncate mt-1.5 px-0.5">{a.name.replace("Sample illustration — ", "")}</div>
            </button>
          ))}
        </div>
      ) : <Empty icon={<Images className="h-6 w-6" />} title="Nothing here yet" body="Upload images to shots, characters or locations and they'll appear in the library." />}
    </Modal>
  );
}
