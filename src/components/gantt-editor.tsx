"use client";

import Link from "next/link";
import { T, TOption, useLang, useT } from "@/components/i18n";
import { localeOf } from "@/lib/i18n";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cpm, type Dep } from "@/lib/cpm";
import { setDates, addDependency, removeDependency, saveMilestone, deleteMilestone, setManyDates } from "@/app/schedule-actions";

export type GRow = {
  id: string; kind: "wi" | "task" | "project"; level: 0 | 1; label: string; sub?: string; href?: string;
  plannedStart: string | null; plannedEnd: string | null; actualStart: string | null; actualEnd: string | null;
  done: boolean; progress?: number | null;
};
export type GMilestone = { id: string; name: string; planned_date: string; actual_date: string | null };
export type Zoom = "week" | "month" | "quarter";

const PX: Record<Zoom, number> = { week: 28, month: 9, quarter: 3.2 };
const DAY = 86_400_000;
const ROW = 46;
const HEAD = 48;
const LABEL_W = 300;
const VAR_W = 90;
const MS_ROW = 40;

const toDay = (d: string) => Math.floor(Date.parse(d.slice(0, 10) + "T00:00:00Z") / DAY);
const toIso = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
let fmtLocale = "en-GB";   // set from the person's language on each render
const fmt = (n: number, o: Intl.DateTimeFormatOptions) => new Date(n * DAY).toLocaleDateString(fmtLocale, { timeZone: "UTC", ...o });
const short = (n: number) => fmt(n, { day: "numeric", month: "short" });

type Drag =
  | { mode: "move" | "start" | "end"; id: string; x0: number; s0: number; e0: number; dx: number }
  | { mode: "link"; id: string; x0: number; y0: number; x: number; y: number }
  | { mode: "ms"; id: string; x0: number; d0: number; dx: number };

export function GanttEditor({ rows, deps, milestones, zoom, editable, projectId }: {
  rows: GRow[]; deps: Dep[]; milestones: GMilestone[]; zoom: Zoom; editable: boolean; projectId: string | null;
}) {
  const router = useRouter();
  const t = useT();
  fmtLocale = localeOf(useLang());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [showCritical, setShowCritical] = useState(true);
  const [selectedDep, setSelectedDep] = useState<string | null>(null);
  const [msForm, setMsForm] = useState<{ id?: string; name: string; date: string; actual?: string } | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const px = PX[zoom];
  const today = Math.floor(Date.now() / DAY);

  // Planned days, with any drag in progress applied.
  const plan = useMemo(() => {
    const m = new Map<string, { s: number; e: number } | null>();
    for (const r of rows) {
      const s = r.plannedStart ? toDay(r.plannedStart) : r.plannedEnd ? toDay(r.plannedEnd) : null;
      const e = r.plannedEnd ? toDay(r.plannedEnd) : s;
      m.set(r.id, s === null || e === null ? null : { s, e });
    }
    if (drag && (drag.mode === "move" || drag.mode === "start" || drag.mode === "end")) {
      const d = Math.round(drag.dx / px);
      const s = drag.mode === "end" ? drag.s0 : drag.s0 + d;
      const e = drag.mode === "start" ? drag.e0 : drag.e0 + d;
      m.set(drag.id, { s: Math.min(s, e), e: Math.max(s, e) });
    }
    return m;
  }, [rows, drag, px]);

  const wiNodes = rows.filter((r) => r.kind === "wi" && plan.get(r.id)).map((r) => ({ id: r.id, start: plan.get(r.id)!.s, end: plan.get(r.id)!.e }));
  const sched = useMemo(() => cpm(wiNodes, deps), [JSON.stringify(wiNodes), deps]); // eslint-disable-line react-hooks/exhaustive-deps

  // Time range.
  const all: number[] = [today];
  rows.forEach((r) => {
    const p = plan.get(r.id); if (p) all.push(p.s, p.e);
    if (r.actualStart) all.push(toDay(r.actualStart));
    if (r.actualEnd) all.push(toDay(r.actualEnd));
  });
  milestones.forEach((m) => all.push(toDay(m.planned_date)));
  const startDay = Math.min(...all) - 7;
  const endDay = Math.max(...all) + 21;
  const width = (endDay - startDay + 1) * px;
  const x = (d: number) => (d - startDay) * px;
  const index = new Map(rows.map((r, i) => [r.id, i]));

  const months: number[] = [], ticks: number[] = [];
  for (let d = startDay; d <= endDay; d++) {
    const dt = new Date(d * DAY);
    if (dt.getUTCDate() === 1 || d === startDay) months.push(d);
    if (zoom === "week" || (zoom === "month" && dt.getUTCDay() === 1)) ticks.push(d);
  }

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error); else { setError(null); router.refresh(); }
    });

  // ---- pointer handling
  const onBarDown = (e: React.PointerEvent, r: GRow, mode: "move" | "start" | "end") => {
    if (!editable || r.kind === "project") return;
    const p = plan.get(r.id); if (!p) return;
    e.preventDefault(); e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ mode, id: r.id, x0: e.clientX, s0: p.s, e0: p.e, dx: 0 });
  };
  const onLinkDown = (e: React.PointerEvent, r: GRow) => {
    if (!editable) return;
    e.preventDefault(); e.stopPropagation();
    const box = area.current!.getBoundingClientRect();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ mode: "link", id: r.id, x0: e.clientX - box.left, y0: e.clientY - box.top, x: e.clientX - box.left, y: e.clientY - box.top });
  };
  const onMsDown = (e: React.PointerEvent, m: GMilestone) => {
    if (!editable) return;
    e.preventDefault(); e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ mode: "ms", id: m.id, x0: e.clientX, d0: toDay(m.planned_date), dx: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    if (drag.mode === "link") {
      const box = area.current!.getBoundingClientRect();
      setDrag({ ...drag, x: e.clientX - box.left, y: e.clientY - box.top });
    } else setDrag({ ...drag, dx: e.clientX - drag.x0 });
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const d = drag; setDrag(null);
    if (d.mode === "link") {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-row]") as HTMLElement | null;
      const target = el?.dataset.row;
      const kind = el?.dataset.kind;
      if (target && target !== d.id && kind === "wi") run(() => addDependency(d.id, target));
      return;
    }
    if (d.mode === "ms") {
      const days = Math.round(d.dx / px);
      const m = milestones.find((x) => x.id === d.id);
      if (days && m) run(() => saveMilestone({ id: m.id, project_id: projectId!, name: m.name, planned_date: toIso(d.d0 + days), actual_date: m.actual_date }));
      return;
    }
    const days = Math.round(d.dx / px);
    if (!days) return;
    const p = plan.get(d.id)!;
    const r = rows.find((x) => x.id === d.id)!;
    run(() => setDates(r.kind as "wi" | "task", d.id, toIso(p.s), toIso(p.e)));
  };

  const reschedule = () => {
    const changes = wiNodes
      .filter((n) => sched.es.get(n.id) !== n.start)
      .map((n) => ({ id: n.id, start: toIso(sched.es.get(n.id)!), end: toIso(sched.ef.get(n.id)!) }));
    if (!changes.length) { setError(null); return; }
    run(() => setManyDates(changes));
  };
  const pushNeeded = wiNodes.filter((n) => sched.es.get(n.id) !== n.start).length;
  const variance = (r: GRow) => {
    const p = plan.get(r.id); if (!p) return null;
    if (r.done && r.actualEnd) return toDay(r.actualEnd) - p.e;
    if (!r.done && today > p.e) return today - p.e;
    return null;
  };

  if (!rows.length && !milestones.length) {
    return <p className="py-10 text-center text-sm text-muted"><T>{"Nothing with dates yet. Add planned start and finish dates to work items or site tasks."}</T></p>;
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        {wiNodes.length > 0 && (
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={showCritical} onChange={(e) => setShowCritical(e.target.checked)} /><T>{"Show critical path"}</T></label>
        )}
        {editable && pushNeeded > 0 && (
          <button className="btn btn-sm" onClick={reschedule} disabled={pending}>
            Reschedule {pushNeeded} item{pushNeeded > 1 ? "s" : ""} to follow dependencies
          </button>
        )}
        {editable && projectId && (
          <button className="btn btn-sm" onClick={() => setMsForm({ name: "", date: toIso(today) })}><T>{"+ Milestone"}</T></button>
        )}
        {sched.cycle && <span className="text-[var(--bad)]">{t("Some dependencies loop back on themselves; remove one to fix the critical path.")}</span>}
        {pending && <span className="text-muted"><T>{"Saving…"}</T></span>}
        {error && <span className="text-[var(--bad)]">{t("Couldn't save:")} {error}</span>}
        {editable && <span className="ms-auto text-xs text-muted">{t("Drag bars to move · drag a bar's end to resize · drag its dot onto another bar to link · click a link to edit · double-click a milestone to edit")}</span>}
      </div>

      {msForm && (
        <form className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-line p-3 text-sm"
          onSubmit={(e) => { e.preventDefault(); const f = msForm; setMsForm(null);
            run(() => saveMilestone({ id: f.id, project_id: projectId!, name: f.name, planned_date: f.date, actual_date: f.actual || null })); }}>
          <label className="flex flex-col gap-1"><span className="text-muted"><T>{"Milestone"}</T></span>
            <input className="input w-64" required value={msForm.name} onChange={(e) => setMsForm({ ...msForm, name: e.target.value })} placeholder={t("e.g. Slab handover")} /></label>
          <label className="flex flex-col gap-1"><span className="text-muted"><T>{"Date"}</T></span>
            <input className="input" type="date" required value={msForm.date} onChange={(e) => setMsForm({ ...msForm, date: e.target.value })} /></label>
          {msForm.id && (
            <label className="flex flex-col gap-1"><span className="text-muted"><T>{"Achieved on"}</T></span>
              <input className="input" type="date" value={msForm.actual ?? ""} onChange={(e) => setMsForm({ ...msForm, actual: e.target.value })} /></label>
          )}
          <button className="btn btn-sm btn-primary">{t(msForm.id ? "Save" : "Add")}</button>
          {msForm.id && <button type="button" className="btn btn-sm" onClick={() => { const id = msForm.id!; setMsForm(null); run(() => deleteMilestone(id)); }}><T>{"Delete"}</T></button>}
          <button type="button" className="btn btn-sm" onClick={() => setMsForm(null)}><T>{"Cancel"}</T></button>
        </form>
      )}

      <div dir="ltr" className="-mx-4 overflow-x-auto" onPointerMove={onMove} onPointerUp={onUp}>
        <div style={{ width: LABEL_W + width + VAR_W }} className="relative select-none text-sm">
          {/* Header */}
          <div className="sticky top-0 z-10 flex border-b border-line bg-surface" style={{ height: HEAD }}>
            <div style={{ width: LABEL_W }} className="sticky left-0 z-20 shrink-0 border-r border-line bg-surface px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted"><T>{"Item"}</T></div>
            <div style={{ width }} className="relative shrink-0">
              {months.map((m) => <div key={m} style={{ left: x(m) }} className="absolute top-0 h-full border-l border-line pl-1.5 pt-1 text-xs font-medium">{fmt(m, { month: "short", year: "numeric" })}</div>)}
              {ticks.map((t) => <div key={t} style={{ left: x(t), width: zoom === "week" ? px : undefined }} className="absolute bottom-1 text-center text-[10px] text-muted">{new Date(t * DAY).getUTCDate()}</div>)}
            </div>
            <div style={{ width: VAR_W }} className="shrink-0 px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted"><T>{"Variance"}</T></div>
          </div>

          {/* Milestones row */}
          {projectId && (
            <div className="relative flex border-b border-line bg-[var(--neutral-bg)]/40" style={{ height: MS_ROW }}>
              <div style={{ width: LABEL_W }} className="sticky left-0 z-[5] flex shrink-0 items-center border-r border-line bg-surface px-4 text-xs font-medium uppercase tracking-wide text-muted"><T>{"Milestones"}</T></div>
              <div style={{ width }} className="relative shrink-0">
                {milestones.map((m) => {
                  const d = toDay(m.planned_date) + (drag?.mode === "ms" && drag.id === m.id ? Math.round(drag.dx / px) : 0);
                  const hit = m.actual_date && toDay(m.actual_date) <= toDay(m.planned_date);
                  const missed = !m.actual_date && today > d;
                  return (
                    <div key={m.id} style={{ left: x(d) + px / 2 - 7, top: 6 }} className="absolute flex items-center gap-1.5 whitespace-nowrap"
                      title={`${m.name}: ${short(d)}${m.actual_date ? ` (${t("achieved")} ${short(toDay(m.actual_date))})` : ""}`}>
                      <span onPointerDown={(e) => onMsDown(e, m)}
                        onDoubleClick={() => editable && setMsForm({ id: m.id, name: m.name, date: m.planned_date, actual: m.actual_date ?? "" })}
                        className={`inline-block h-3.5 w-3.5 rotate-45 border-2 ${editable ? "cursor-grab" : ""}`}
                        style={{ borderColor: missed ? "var(--bad)" : hit ? "var(--good)" : "var(--brand)", background: m.actual_date ? (hit ? "var(--good)" : "var(--bad)") : "var(--surface)" }} />
                      <span className="text-xs">{m.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gridlines, today, milestone lines */}
          <div className="pointer-events-none absolute bottom-0" style={{ left: LABEL_W, width, top: HEAD }}>
            {months.map((m) => <div key={m} style={{ left: x(m) }} className="absolute inset-y-0 border-l border-line" />)}
            {milestones.map((m) => <div key={m.id} style={{ left: x(toDay(m.planned_date)) + px / 2 }} className="absolute inset-y-0 border-l border-dashed border-[var(--brand)] opacity-40" />)}
            <div style={{ left: x(today) + px / 2 }} className="absolute inset-y-0 w-0.5 bg-[var(--bad)] opacity-70" />
          </div>

          {/* Rows */}
          <div ref={area} className="relative">
            {rows.map((r) => {
              const p = plan.get(r.id);
              const as = r.actualStart ? toDay(r.actualStart) : null;
              const ae = r.actualEnd ? toDay(r.actualEnd) : as !== null ? today : null;
              const v = variance(r);
              const late = v !== null && v > 0;
              const crit = showCritical && r.kind === "wi" && sched.critical.has(r.id);
              const fl = r.kind === "wi" ? sched.float.get(r.id) : undefined;
              const tone = late ? "var(--bad)" : r.done ? "var(--good)" : "var(--info)";
              const lbl = (<><div className={`truncate ${r.level === 0 ? "font-medium" : ""}`}>{r.label}</div>{r.sub && <div className="truncate text-xs text-muted">{r.sub}</div>}</>);
              return (
                <div key={r.id} className="relative flex border-b border-line" style={{ height: ROW }}>
                  <div style={{ width: LABEL_W, paddingLeft: r.level ? 32 : 16 }} className="sticky left-0 z-[5] flex shrink-0 flex-col justify-center border-r border-line bg-surface pr-3">
                    {r.href ? <Link href={r.href} className="hover:underline">{lbl}</Link> : lbl}
                  </div>
                  <div style={{ width }} className="relative shrink-0" data-row={r.id} data-kind={r.kind}>
                    {p && (
                      <div data-row={r.id} data-kind={r.kind}
                        title={`${t("Planned")} ${short(p.s)} – ${short(p.e)} (${t("{n} days", { n: p.e - p.s + 1 })})${fl !== undefined && !sched.cycle ? ` · ${t("float {n} days", { n: fl })}` : ""}`}
                        style={{ left: x(p.s), width: Math.max((p.e - p.s + 1) * px, 6), top: 8,
                          borderColor: crit ? "var(--bad)" : "var(--muted)", borderWidth: crit ? 2 : 1 }}
                        onPointerDown={(e) => onBarDown(e, r, "move")}
                        className={`group absolute h-[13px] overflow-visible rounded-sm border bg-[var(--neutral-bg)] ${editable && r.kind !== "project" ? "cursor-grab active:cursor-grabbing" : ""}`}>
                        {r.progress ? <div className="h-full bg-[var(--muted)] opacity-40" style={{ width: `${Math.round(r.progress * 100)}%` }} /> : null}
                        {editable && r.kind !== "project" && (
                          <>
                            <span onPointerDown={(e) => onBarDown(e, r, "start")} className="absolute -left-1 top-0 h-full w-2 cursor-ew-resize" />
                            <span onPointerDown={(e) => onBarDown(e, r, "end")} className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize" />
                            {r.kind === "wi" && (
                              <span onPointerDown={(e) => onLinkDown(e, r)} title={t("Drag onto another work item to make it follow this one")}
                                className="absolute -right-4 top-1/2 hidden h-2.5 w-2.5 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-[var(--brand)] bg-surface group-hover:block" />
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {as !== null && ae !== null && (
                      <div title={`${t("Actual")} ${short(as)} – ${r.done ? short(ae) : t("ongoing")}`}
                        style={{ left: x(as), width: Math.max((ae - as + 1) * px, 4), top: 26, background: tone }}
                        className={`pointer-events-none absolute h-[11px] rounded-sm ${r.done ? "" : "gantt-ongoing"}`} />
                    )}
                  </div>
                  <div style={{ width: VAR_W }} className="flex shrink-0 items-center px-2 text-xs tabular-nums">
                    {v === null ? <span className="text-muted">{r.done ? t("On time") : crit ? t("Critical") : "—"}</span>
                      : v > 0 ? <span className="font-medium text-[var(--bad)]">{t("{n}d late", { n: v })}</span>
                      : v < 0 ? <span className="text-[var(--good)]">{t("{n}d early", { n: -v })}</span>
                      : <span className="text-[var(--good)]"><T>{"On time"}</T></span>}
                  </div>
                </div>
              );
            })}

            {/* Dependency arrows */}
            <svg className="pointer-events-none absolute left-0 top-0" style={{ left: LABEL_W }} width={width} height={rows.length * ROW}>
              <defs>
                <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 8 4 0 8z" fill="var(--muted)" /></marker>
                <marker id="arr-c" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 8 4 0 8z" fill="var(--bad)" /></marker>
              </defs>
              {deps.map((d) => {
                const pi = index.get(d.pred), si = index.get(d.succ);
                const pp = plan.get(d.pred), sp = plan.get(d.succ);
                if (pi === undefined || si === undefined || !pp || !sp) return null;
                const fromEnd = d.kind === "FS" || d.kind === "FF";
                const toEnd = d.kind === "FF" || d.kind === "SF";
                const x1 = fromEnd ? x(pp.e) + px : x(pp.s);
                const y1 = pi * ROW + 14;
                const x2 = toEnd ? x(sp.e) + px : x(sp.s);
                const y2 = si * ROW + 14;
                const mid = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 8));
                const path = x2 - 8 >= x1 + 8
                  ? `M${x1},${y1} H${mid} V${y2} H${x2 - 1}`
                  : `M${x1},${y1} h8 V${(y1 + y2) / 2} H${x2 - 10} V${y2} H${x2 - 1}`;
                const key = `${d.pred}>${d.succ}`;
                const critical = showCritical && sched.critical.has(d.pred) && sched.critical.has(d.succ);
                return (
                  <g key={key} className="pointer-events-auto cursor-pointer" onClick={() => editable && setSelectedDep(key)}>
                    <path d={path} fill="none" stroke="transparent" strokeWidth={10} />
                    <path d={path} fill="none" stroke={critical ? "var(--bad)" : "var(--muted)"} strokeWidth={selectedDep === key ? 2.5 : 1.3}
                      markerEnd={`url(#${critical ? "arr-c" : "arr"})`} />
                    {(d.lag !== 0 || d.kind !== "FS") && <text x={x2 - 14} y={y2 - 4} fontSize="9" textAnchor="end" fill="var(--muted)">{d.kind}{d.lag ? (d.lag > 0 ? `+${d.lag}d` : `${d.lag}d`) : ""}</text>}
                  </g>
                );
              })}
              {drag?.mode === "link" && <line x1={drag.x0 - LABEL_W} y1={drag.y0} x2={drag.x - LABEL_W} y2={drag.y} stroke="var(--brand)" strokeWidth={1.5} strokeDasharray="4 3" />}
            </svg>
          </div>
        </div>
      </div>

      {selectedDep && (() => {
        const [pred, succ] = selectedDep.split(">");
        const d = deps.find((x) => x.pred === pred && x.succ === succ);
        const name = (id: string) => rows.find((r) => r.id === id)?.label ?? "";
        if (!d) return null;
        return (
          <form className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-line p-3 text-sm"
            onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setSelectedDep(null);
              run(() => addDependency(pred, succ, String(f.get("kind")), Number(f.get("lag")) || 0)); }}>
            <div className="flex-1"><span className="text-muted"><T>{"Link:"}</T></span> <b>{name(succ)}</b> <T>{"follows"}</T> <b>{name(pred)}</b></div>
            <label className="flex flex-col gap-1"><span className="text-muted"><T>{"Type"}</T></span>
              <select name="kind" defaultValue={d.kind} className="input w-48">
                <TOption value="FS" label="Finish → Start" /><TOption value="SS" label="Start → Start" />
                <TOption value="FF" label="Finish → Finish" /><TOption value="SF" label="Start → Finish" />
              </select></label>
            <label className="flex flex-col gap-1"><span className="text-muted"><T>{"Lag (days)"}</T></span>
              <input name="lag" type="number" defaultValue={d.lag} className="input w-24" /></label>
            <button className="btn btn-sm btn-primary"><T>{"Save"}</T></button>
            <button type="button" className="btn btn-sm" onClick={() => { setSelectedDep(null); run(() => removeDependency(pred, succ)); }}><T>{"Remove link"}</T></button>
            <button type="button" className="btn btn-sm" onClick={() => setSelectedDep(null)}><T>{"Close"}</T></button>
          </form>
        );
      })()}
    </div>
  );
}

export function GanttLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-sm border border-[var(--muted)] bg-[var(--neutral-bg)]" /><T>{"Planned (shaded = % complete)"}</T></span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-sm border-2 border-[var(--bad)] bg-[var(--neutral-bg)]" /><T>{"Critical path"}</T></span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-sm bg-[var(--good)]" /><T>{"Actual, on time"}</T></span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-sm bg-[var(--info)]" /><T>{"Actual, in progress"}</T></span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-sm bg-[var(--bad)]" /><T>{"Running late"}</T></span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rotate-45 border-2 border-[var(--brand)]" /><T>{"Milestone"}</T></span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-0.5 bg-[var(--bad)]" /><T>{"Today"}</T></span>
    </div>
  );
}
