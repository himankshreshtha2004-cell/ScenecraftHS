import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ImagePlus, Lock, Unlock, X } from "lucide-react";
import React, { forwardRef, useEffect, useId, useRef, useState } from "react";
import { create } from "zustand";
import { useAssetUrls } from "../lib/assets";
import { aspectRatio } from "../lib/options";
import type { Asset } from "../lib/types";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ buttons */
type BtnTone = "primary" | "ai" | "ghost" | "subtle" | "danger" | "ok";
const tones: Record<BtnTone, string> = {
  primary: "bg-amber text-[#1b1208] hover:bg-[#f0bd8c] shadow-[0_8px_24px_-12px_rgba(232,175,121,.7)]",
  ai: "bg-ai-soft text-ai border border-ai/30 hover:bg-ai/20",
  ghost: "text-ink/90 hover:bg-white/[.06]",
  subtle: "bg-panel text-ink border border-line hover:bg-raise hover:border-[#454959]",
  danger: "bg-bad-soft text-bad border border-bad/30 hover:bg-bad/20",
  ok: "bg-ok-soft text-ok border border-ok/30 hover:bg-ok/20",
};
export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: BtnTone; size?: "sm" | "md" | "lg"; icon?: React.ReactNode }>(
  ({ tone = "subtle", size = "md", icon, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background,color,border,transform,box-shadow] duration-150 active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/70 whitespace-nowrap select-none",
        size === "sm" ? "h-8 px-3 text-[13px]" : size === "lg" ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-sm",
        tones[tone], className,
      )}
    >
      {icon}
      {children}
    </button>
  ),
);

export function IconButton({ label, children, className, active, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        "inline-grid place-items-center h-9 w-9 rounded-lg text-mute hover:text-ink hover:bg-white/[.06] transition-colors disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/70",
        active && "bg-white/[.08] text-ink", className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ form fields */
export function Field({ label, hint, children, className, right }: { label: string; hint?: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <label className={cx("block", className)}>
      <span className="flex items-center justify-between mb-1.5">
        <span className="text-[12.5px] font-medium text-mute">{label}</span>
        {right}
      </span>
      {children}
      {hint && <span className="block mt-1 text-xs text-faint">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-xl bg-surface border border-line px-3 text-[14px] text-ink placeholder:text-faint focus:outline-none focus:border-amber/60 focus:ring-2 focus:ring-amber/15 transition-colors";
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} {...p} className={cx(inputCls, "h-10", className)} />
));

export function TextArea({ className, minRows = 3, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight + 2, minRows * 22 + 18) + "px";
  }, [p.value, minRows]);
  return <textarea ref={ref} rows={minRows} {...p} className={cx(inputCls, "py-2.5 leading-[22px] resize-none", className)} />;
}

export function Select({ value, onChange, options, className, placeholder, ...rest }: {
  value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; className?: string; placeholder?: string;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value">) {
  return (
    <span className={cx("relative block", className)}>
      <select
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputCls, "h-10 appearance-none pr-9 cursor-pointer")}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; title?: string }[]; className?: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" className={cx("inline-flex max-w-full overflow-x-auto thin-scroll rounded-xl bg-surface border border-line p-1 gap-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-lg font-medium transition-colors inline-flex items-center gap-1.5 justify-center whitespace-nowrap shrink-0",
            size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3.5 text-[13px]",
            value === o.value ? "bg-panel text-ink shadow-card ring-1 ring-white/5" : "text-mute hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/70", checked ? "bg-ok" : "bg-line", className)}
    >
      <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

/** the big, explicit "X Lock: ON/OFF" control */
export function LockToggle({ kind, locked, onChange }: { kind: string; locked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={locked}
      onClick={() => onChange(!locked)}
      className={cx(
        "inline-flex items-center gap-2.5 h-10 pl-3 pr-4 rounded-xl border text-sm font-semibold transition-colors",
        locked ? "bg-ok-soft border-ok/40 text-ok" : "bg-surface border-line text-mute hover:text-ink",
      )}
    >
      {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
      {kind} Lock: {locked ? "ON" : "OFF"}
    </button>
  );
}

/* ------------------------------------------------------------------ pills */
export function Pill({ tone = "neutral", children, className, title }: { tone?: "neutral" | "amber" | "ai" | "ok" | "warn" | "bad"; children: React.ReactNode; className?: string; title?: string }) {
  const t = {
    neutral: "bg-white/[.06] text-mute border-white/[.06]", amber: "bg-amber-soft text-amber border-amber/25", ai: "bg-ai-soft text-ai border-ai/25",
    ok: "bg-ok-soft text-ok border-ok/25", warn: "bg-warn-soft text-warn border-warn/25", bad: "bg-bad-soft text-bad border-bad/25",
  }[tone];
  return <span title={title} className={cx("inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[11.5px] font-semibold tracking-wide whitespace-nowrap", t, className)}>{children}</span>;
}

/* ------------------------------------------------------------------ images */
export function AssetImg({ id, assets, aspect, className, fit = "cover", label = true, alt = "", rounded = "rounded-xl", children }: {
  id: string | null | undefined; assets: Asset[]; aspect?: string; className?: string; fit?: "cover" | "contain"; label?: boolean; alt?: string; rounded?: string; children?: React.ReactNode;
}) {
  const url = useAssetUrls((s) => (id ? s.urls[id] : undefined));
  const a = id ? assets.find((x) => x.id === id) : undefined;
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const loaded = !!url && loadedUrl === url;
  return (
    <div className={cx("relative overflow-hidden bg-surface", rounded, className)} style={aspect ? { aspectRatio: String(aspectRatio(aspect)) } : undefined}>
      {url ? (
        <>
          {!loaded && <div className="absolute inset-0 skeleton" />}
          <img src={url} alt={alt || a?.name || ""} draggable={false} ref={(el) => { if (el?.complete && el.naturalWidth && loadedUrl !== url) setLoadedUrl(url); }} onLoad={() => setLoadedUrl(url)} className={cx("absolute inset-0 h-full w-full transition-opacity duration-300", fit === "cover" ? "object-cover" : "object-contain", loaded ? "opacity-100" : "opacity-0")} />
        </>
      ) : id ? <div className="absolute inset-0 skeleton" /> : null}
      {label && a?.origin === "sample" && <span className="absolute left-2 bottom-2 rounded-md bg-black/55 backdrop-blur px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/75">Sample illustration</span>}
      {label && a?.origin === "generated" && <span className="absolute left-2 bottom-2 rounded-md bg-ai/30 backdrop-blur px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">AI image</span>}
      {children}
    </div>
  );
}

/** an empty image slot that accepts click-to-upload or a dropped file */
export function DropSlot({ onFiles, aspect, label = "Add image", sub = "Click or drop an image", className, compact }: { onFiles: (f: FileList) => void; aspect?: string; label?: string; sub?: string; className?: string; compact?: boolean }) {
  const [over, setOver] = useState(false);
  const id = useId();
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files); }}
      className={cx("relative grid place-items-center rounded-xl border border-dashed cursor-pointer transition-colors text-center", over ? "border-amber bg-amber-soft" : "border-[#3d4150] bg-surface/60 hover:border-amber/60 hover:bg-surface", className)}
      style={aspect ? { aspectRatio: String(aspectRatio(aspect)) } : undefined}
    >
      <input id={id} type="file" accept="image/*" className="sr-only" onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }} />
      <span className="flex flex-col items-center gap-1.5 px-3 text-mute">
        <ImagePlus className={compact ? "h-4 w-4" : "h-6 w-6"} />
        <span className={cx("font-medium text-ink/90", compact ? "text-xs" : "text-sm")}>{label}</span>
        {!compact && <span className="text-xs text-faint">{sub}</span>}
      </span>
    </label>
  );
}

export function FileButton({ onFiles, children, tone = "subtle", size = "md", accept = "image/*", multiple, icon }: { onFiles: (f: FileList) => void; children: React.ReactNode; tone?: BtnTone; size?: "sm" | "md"; accept?: string; multiple?: boolean; icon?: React.ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="sr-only" tabIndex={-1} onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }} />
      <Button tone={tone} size={size} icon={icon} onClick={() => ref.current?.click()}>{children}</Button>
    </>
  );
}

/* ------------------------------------------------------------------ overlays */
export function Modal({ open, onClose, title, children, width = 560, footer, sub }: { open: boolean; onClose: () => void; title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode; width?: number; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}
            className="relative w-full max-h-[90vh] overflow-hidden rounded-2xl bg-panel border border-line shadow-pop flex flex-col"
            style={{ maxWidth: width }}
            initial={{ y: 12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 8, scale: 0.98 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
              <div><h2 className="text-[17px] font-semibold">{title}</h2>{sub && <p className="text-sm text-mute mt-1">{sub}</p>}</div>
              <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1"><X className="h-4 w-4" /></IconButton>
            </div>
            <div className="px-6 pb-5 overflow-y-auto thin-scroll">{children}</div>
            {footer && <div className="px-6 py-4 border-t border-line flex justify-end gap-2 bg-surface/40">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* confirm dialog, usable from anywhere: await confirmDialog({...}) */
interface ConfirmReq { title: string; body?: string; ok?: string; danger?: boolean; resolve: (v: boolean) => void }
const useConfirm = create<{ req: ConfirmReq | null }>(() => ({ req: null }));
export const confirmDialog = (o: Omit<ConfirmReq, "resolve">) => new Promise<boolean>((resolve) => useConfirm.setState({ req: { ...o, resolve } }));
export function ConfirmHost() {
  const req = useConfirm((s) => s.req);
  const close = (v: boolean) => { req?.resolve(v); useConfirm.setState({ req: null }); };
  return (
    <Modal open={!!req} onClose={() => close(false)} title={req?.title ?? ""} width={440}
      footer={<><Button tone="ghost" onClick={() => close(false)}>Cancel</Button><Button autoFocus tone={req?.danger ? "danger" : "primary"} onClick={() => close(true)}>{req?.ok ?? "OK"}</Button></>}>
      {req?.body && <p className="text-sm text-mute leading-relaxed">{req.body}</p>}
    </Modal>
  );
}

/* prompt-for-text dialog (rename etc.) */
interface AskReq { title: string; value: string; ok?: string; resolve: (v: string | null) => void }
const useAsk = create<{ req: AskReq | null }>(() => ({ req: null }));
export const askText = (o: Omit<AskReq, "resolve">) => new Promise<string | null>((resolve) => useAsk.setState({ req: { ...o, resolve } }));
export function AskHost() {
  const req = useAsk((s) => s.req);
  const [v, setV] = useState("");
  useEffect(() => { if (req) setV(req.value); }, [req]);
  const close = (val: string | null) => { req?.resolve(val); useAsk.setState({ req: null }); };
  return (
    <Modal open={!!req} onClose={() => close(null)} title={req?.title ?? ""} width={440}
      footer={<><Button tone="ghost" onClick={() => close(null)}>Cancel</Button><Button tone="primary" onClick={() => close(v)}>{req?.ok ?? "Save"}</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); close(v); }}>
        <Input autoFocus value={v} onChange={(e) => setV(e.target.value)} onFocus={(e) => e.target.select()} />
      </form>
    </Modal>
  );
}

/** a small dropdown menu */
export function Menu({ trigger, items, align = "right" }: { trigger: (open: boolean, toggle: () => void) => React.ReactNode; items: ({ label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean } | "sep")[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      {trigger(open, () => setOpen((o) => !o))}
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
            className={cx("absolute z-50 mt-1.5 min-w-[200px] rounded-xl bg-panel border border-line shadow-pop p-1.5", align === "right" ? "right-0" : "left-0")}>
            {items.map((it, i) => it === "sep" ? <div key={i} className="my-1 h-px bg-line" /> : (
              <button key={i} role="menuitem" disabled={it.disabled} onClick={() => { setOpen(false); it.onClick(); }}
                className={cx("w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[13.5px] text-left transition-colors disabled:opacity-35", it.danger ? "text-bad hover:bg-bad-soft" : "text-ink/90 hover:bg-white/[.06]")}>
                <span className="w-4 h-4 grid place-items-center text-mute">{it.icon}</span>{it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Collapsible({ title, children, defaultOpen = true, right, icon }: { title: string; children: React.ReactNode; defaultOpen?: boolean; right?: React.ReactNode; icon?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-line first:border-t-0">
      <div className="flex items-center gap-2 py-3">
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex-1 flex items-center gap-2 text-left text-[13px] font-semibold text-ink/90 hover:text-ink">
          {icon}<span className="flex-1">{title}</span>
          <ChevronDown className={cx("h-4 w-4 text-faint transition-transform", !open && "-rotate-90")} />
        </button>
        {right}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="pb-4 space-y-3.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function Empty({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="h-14 w-14 rounded-2xl bg-panel border border-line grid place-items-center text-mute mb-4">{icon}</div>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      {body && <p className="text-sm text-mute mt-1.5 max-w-sm leading-relaxed">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Card({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx("rounded-2xl bg-surface border border-line", className)}>{children}</div>;
}

export function SectionTitle({ eyebrow, title, sub, right, serif }: { eyebrow?: string; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; serif?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap">
      <div className="min-w-0">
        {eyebrow && <div className="text-[11.5px] font-semibold uppercase tracking-[.14em] text-faint mb-1.5">{eyebrow}</div>}
        <h1 className={cx(serif ? "font-serif text-[44px] leading-[1.02] tracking-[-.01em]" : "text-[26px] font-semibold tracking-[-.02em]")}>{title}</h1>
        {sub && <p className="text-[14.5px] text-mute mt-2 max-w-2xl leading-relaxed">{sub}</p>}
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
    </div>
  );
}

export function Progress({ value, tone = "amber", className }: { value: number; tone?: "amber" | "ok" | "ai"; className?: string }) {
  const c = tone === "ok" ? "bg-ok" : tone === "ai" ? "bg-ai" : "bg-amber";
  return (
    <div className={cx("h-1.5 rounded-full bg-white/[.07] overflow-hidden", className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-[width] duration-500", c)} style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}
