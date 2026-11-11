"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { T, TOption, useT } from "@/components/i18n";
import { useRouter } from "next/navigation";
import { Database, type Settings } from "@/components/database";
import type { Loaded } from "@/lib/sources";
import { updatePage, deletePage, addBlock, updateBlock, moveBlock, deleteBlock } from "@/app/page-actions";

export type Block = {
  id: string; page_id: string; position: number; kind: "text" | "view"; title: string | null; body: string | null;
  source: string | null; project_id: string | null; settings: Partial<Settings>; data: Loaded | null;
};
type PageRow = { id: string; parent_id: string | null; title: string; icon: string | null };

const ICONS = ["📄", "📁", "📊", "🏗️", "🧱", "📋", "✅", "🛒", "💰", "📅", "📌", "⭐"];

export function PageEditor({ page, blocks, projects, pages, canManageFields, sources }: {
  page: PageRow; blocks: Block[]; projects: { id: string; name: string }[]; pages: PageRow[];
  canManageFields: boolean; sources: Record<string, string>;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [iconPick, setIconPick] = useState(false);
  const run = (fn: () => Promise<{ error?: string } | void>) => start(async () => {
    const res = await fn();
    if (res && res.error) setError(res.error); else { setError(null); router.refresh(); }
  });

  // Pages this one may move under: not itself and not its own sub-pages.
  const below = new Set<string>([page.id]);
  for (let grew = true; grew;) { grew = false; for (const p of pages) if (p.parent_id && below.has(p.parent_id) && !below.has(p.id)) { below.add(p.id); grew = true; } }

  const lastPos = blocks.length ? blocks[blocks.length - 1].position : -1;

  return (
    <div>
      <div className="group/title mb-4 flex items-start gap-2">
        <div className="relative">
          <button onClick={() => setIconPick(!iconPick)} className="rounded-lg px-1 text-4xl leading-tight hover:bg-[var(--neutral-bg)]" title={t("Change icon")}>{page.icon ?? "📄"}</button>
          {iconPick && (
            <div className="absolute start-0 top-12 z-20 grid w-56 grid-cols-6 gap-1 rounded-xl border border-line bg-surface p-2 shadow-lg">
              {ICONS.map((i) => <button key={i} className="rounded p-1 text-xl hover:bg-[var(--neutral-bg)]" onClick={() => { setIconPick(false); run(() => updatePage(page.id, { icon: i })); }}>{i}</button>)}
            </div>
          )}
        </div>
        <input key={page.title} defaultValue={page.title} placeholder={t("Untitled")} aria-label={t("Page title")}
          className="min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted"
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          onBlur={(e) => { const v = e.target.value.trim() || t("Untitled"); if (v !== page.title) run(() => updatePage(page.id, { title: v })); }} />
        <div className="relative">
          <button className="btn btn-sm" onClick={() => setMenu(!menu)}>⋯</button>
          {menu && (
            <div className="absolute end-0 top-9 z-20 w-72 rounded-xl border border-line bg-surface p-3 text-sm shadow-lg">
              <label className="mb-1 block text-xs text-muted"><T>{"Put this page inside"}</T></label>
              <select className="input mb-3 py-1" defaultValue={page.parent_id ?? ""}
                onChange={(e) => { setMenu(false); run(() => updatePage(page.id, { parent_id: e.target.value || null })); }}>
                <option value="">{t("Top level (no parent)")}</option>
                {pages.filter((p) => !below.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.icon ?? "📄"} {p.title}</option>)}
              </select>
              <button className="btn btn-sm w-full justify-center text-[var(--bad)]" onClick={() => {
                if (window.confirm(t("Delete \"{name}\" and every page inside it? The data in linked tables is not affected.", { name: page.title }))) run(() => deletePage(page.id));
              }}><T>{"Delete page"}</T></button>
            </div>
          )}
        </div>
      </div>

      {(pending || error) && <p className={`mb-2 text-xs ${error ? "text-[var(--bad)]" : "text-muted"}`}>{error ?? t("Saving…")}</p>}

      <div className="flex flex-col gap-1">
        {blocks.map((b, i) => (
          <div key={b.id} className="group/block relative">
            <div className="absolute -start-9 top-1 hidden flex-col gap-0.5 group-hover/block:flex">
              <button title={t("Move up")} disabled={i === 0} onClick={() => run(() => moveBlock(page.id, b.id, -1))} className="rounded px-1.5 text-xs text-muted hover:bg-[var(--neutral-bg)] disabled:opacity-30">↑</button>
              <button title={t("Move down")} disabled={i === blocks.length - 1} onClick={() => run(() => moveBlock(page.id, b.id, 1))} className="rounded px-1.5 text-xs text-muted hover:bg-[var(--neutral-bg)] disabled:opacity-30">↓</button>
              <button title={t("Delete block")} onClick={() => { if (b.kind === "text" && !b.body ? true : window.confirm(t("Remove this block from the page?"))) run(() => deleteBlock(b.id)); }} className="rounded px-1.5 text-xs text-muted hover:bg-[var(--neutral-bg)] hover:text-[var(--bad)]">×</button>
            </div>
            {b.kind === "text"
              ? <TextBlock block={b} save={(body) => run(() => updateBlock(b.id, { body }))} />
              : <ViewBlock block={b} projects={projects} sources={sources} canManageFields={canManageFields} run={run} />}
            <AddBar onText={() => run(() => addBlock(page.id, "text", b.position))}
              onView={() => run(() => addBlock(page.id, "view", b.position, "work_items", null))} />
          </div>
        ))}
        {!blocks.length && (
          <AddBar always onText={() => run(() => addBlock(page.id, "text", lastPos))}
            onView={() => run(() => addBlock(page.id, "view", lastPos, "work_items", null))} />
        )}
      </div>
    </div>
  );
}

function AddBar({ onText, onView, always }: { onText: () => void; onView: () => void; always?: boolean }) {
  return (
    <div className={`flex gap-2 py-1 text-xs text-muted ${always ? "" : "opacity-0 transition-opacity hover:opacity-100 group-hover/block:opacity-60"}`}>
      <button onClick={onText} className="rounded px-2 py-0.5 hover:bg-[var(--neutral-bg)] hover:text-fg"><T>{"+ Text"}</T></button>
      <button onClick={onView} className="rounded px-2 py-0.5 hover:bg-[var(--neutral-bg)] hover:text-fg"><T>{"+ Table / board view"}</T></button>
    </div>
  );
}

/** Plain text that grows as you type and saves when you click away. Lines starting with "# " show as headings. */
function TextBlock({ block, save }: { block: Block; save: (body: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focus, setFocus] = useState(false);
  const t = useT();
  const grow = () => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } };
  useEffect(grow, [focus]);
  const body = block.body ?? "";
  if (!focus && body) {
    return (
      <div onClick={() => setFocus(true)} className="cursor-text rounded px-1 py-1 text-[15px] leading-relaxed hover:bg-[var(--neutral-bg)]/50">
        {body.split("\n").map((line, i) => line.startsWith("## ") ? <h3 key={i} className="mt-3 text-lg font-semibold">{line.slice(3)}</h3>
          : line.startsWith("# ") ? <h2 key={i} className="mt-4 text-xl font-semibold">{line.slice(2)}</h2>
          : line.startsWith("- ") ? <div key={i} className="flex gap-2 ps-1"><span>•</span><span>{line.slice(2)}</span></div>
          : <p key={i} className="min-h-[1.5em] whitespace-pre-wrap">{line}</p>)}
      </div>
    );
  }
  return (
    <textarea ref={ref} autoFocus={focus} defaultValue={body} rows={1} onInput={grow} onFocus={() => setFocus(true)}
      placeholder={t("Type notes here. Start a line with # for a heading or - for a bullet.")}
      className="w-full resize-none overflow-hidden rounded bg-transparent px-1 py-1 text-[15px] leading-relaxed outline-none placeholder:text-muted/70 focus:bg-[var(--neutral-bg)]/40"
      onBlur={(e) => { setFocus(false); if (e.target.value !== body) save(e.target.value); }} />
  );
}

function ViewBlock({ block, projects, sources, canManageFields, run }: {
  block: Block; projects: { id: string; name: string }[]; sources: Record<string, string>; canManageFields: boolean;
  run: (fn: () => Promise<{ error?: string } | void>) => void;
}) {
  const d = block.data;
  const projectName = projects.find((p) => p.id === block.project_id)?.name;
  const [setup, setSetup] = useState(false);
  const t = useT();
  return (
    <div className="my-2 rounded-xl border border-line bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input key={block.title ?? ""} defaultValue={block.title ?? ""} placeholder={`${t(sources[block.source ?? ""] ?? "View")}${projectName ? ` · ${projectName}` : ""}`}
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-fg"
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          onBlur={(e) => { if (e.target.value !== (block.title ?? "")) run(() => updateBlock(block.id, { title: e.target.value || null })); }} />
        <button className="btn btn-sm" onClick={() => setSetup(!setup)}><T>{"Data source"}</T></button>
      </div>
      {setup && (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-line p-3 text-sm">
          <label className="flex flex-col gap-1 text-xs text-muted"><T>{"Show"}</T>
            <select className="input w-52 py-1 text-sm text-fg" defaultValue={block.source ?? "work_items"}
              onChange={(e) => run(() => updateBlock(block.id, { source: e.target.value, settings: { view: block.settings.view ?? "table" } }))}>
              {Object.entries(sources).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
            </select></label>
          {block.source !== "vendors" && (
            <label className="flex flex-col gap-1 text-xs text-muted"><T>{"From project"}</T>
              <select className="input w-64 py-1 text-sm text-fg" defaultValue={block.project_id ?? ""}
                onChange={(e) => run(() => updateBlock(block.id, { project_id: e.target.value || null }))}>
                <TOption value="" label="All projects" />
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></label>
          )}
          <p className="w-full text-xs text-muted">{t("Use Filter, Sort, Group and Fields on the view itself; they are saved for everyone who opens this page.")}</p>
        </div>
      )}
      {d ? (
        <Database id={`block:${block.id}`} table={d.table} rows={d.rows} columns={d.columns} titleKey={d.titleKey} href={d.href}
          editable={d.editable} creatable={d.creatable} createDefaults={d.createDefaults}
          fieldsTable={d.fieldsTable} canManageFields={canManageFields && !!d.fieldsTable}
          initial={block.settings} onSettingsChange={(s) => run(() => updateBlock(block.id, { settings: s }))} />
      ) : <p className="text-sm text-muted">{t("This view can't be shown.")}</p>}
    </div>
  );
}
