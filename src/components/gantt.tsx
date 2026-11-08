import Link from "next/link";

export type GanttRow = {
  id: string;
  label: string;
  sub?: string;
  level: 0 | 1;              // 0 = work item, 1 = site task under it
  href?: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;   // null while still running
  done: boolean;
  progress?: number | null;   // 0..1, work items only
};

export type Zoom = "week" | "month" | "quarter";
const PX: Record<Zoom, number> = { week: 28, month: 9, quarter: 3.2 };
const DAY = 86_400_000;
const ROW = 46;
const LABEL_W = 300;

const toDay = (d: string) => Math.floor(Date.parse(d.slice(0, 10) + "T00:00:00Z") / DAY);
const fromDay = (n: number) => new Date(n * DAY);
const fmt = (n: number, opts: Intl.DateTimeFormatOptions) => fromDay(n).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

/** Days late (+) or early (-) against the planned finish; null when it can't be judged yet. */
export function variance(r: GanttRow, today: number): number | null {
  if (!r.plannedEnd) return null;
  const plan = toDay(r.plannedEnd);
  if (r.done && r.actualEnd) return toDay(r.actualEnd) - plan;
  if (!r.done && today > plan) return today - plan;
  return null;
}

export function Gantt({ rows, zoom }: { rows: GanttRow[]; zoom: Zoom }) {
  const today = Math.floor(Date.now() / DAY);
  const days = rows.flatMap((r) => [r.plannedStart, r.plannedEnd, r.actualStart, r.actualEnd].filter(Boolean).map((d) => toDay(d!)));
  days.push(today);
  const start = Math.min(...days) - 7;
  const end = Math.max(...days) + 14;
  const px = PX[zoom];
  const width = (end - start + 1) * px;
  const x = (d: number) => (d - start) * px;

  // Header ticks: months always; weeks (Mondays) or days when zoomed in.
  const months: { day: number; label: string }[] = [];
  const ticks: { day: number; label: string }[] = [];
  for (let d = start; d <= end; d++) {
    const dt = fromDay(d);
    if (dt.getUTCDate() === 1 || d === start) months.push({ day: d, label: fmt(d, { month: "short", year: "numeric" }) });
    if (zoom === "week") ticks.push({ day: d, label: String(dt.getUTCDate()) });
    else if (zoom === "month" && dt.getUTCDay() === 1) ticks.push({ day: d, label: String(dt.getUTCDate()) });
  }

  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-muted">No work items or site tasks with dates yet. Add planned start and finish dates to see them here.</p>;
  }

  return (
    <div className="gantt -mx-4 overflow-x-auto">
      <div style={{ width: LABEL_W + width + 90 }} className="relative text-sm">
        {/* Header */}
        <div className="sticky top-0 z-10 flex border-b border-line bg-surface">
          <div style={{ width: LABEL_W }} className="sticky left-0 z-20 shrink-0 border-r border-line bg-surface px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted">
            Work item / site task
          </div>
          <div style={{ width }} className="relative h-12 shrink-0">
            {months.map((m) => (
              <div key={m.day} style={{ left: x(m.day) }} className="absolute top-0 h-full border-l border-line pl-1.5 pt-1 text-xs font-medium">{m.label}</div>
            ))}
            {ticks.map((t) => (
              <div key={t.day} style={{ left: x(t.day), width: zoom === "week" ? px : undefined }} className="absolute bottom-1 text-center text-[10px] text-muted">{t.label}</div>
            ))}
          </div>
          <div className="w-[90px] shrink-0 px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted">Variance</div>
        </div>

        {/* Gridlines + today */}
        <div className="pointer-events-none absolute bottom-0 top-12" style={{ left: LABEL_W, width }}>
          {months.map((m) => <div key={m.day} style={{ left: x(m.day) }} className="absolute inset-y-0 border-l border-line" />)}
          <div style={{ left: x(today) + px / 2 }} className="absolute inset-y-0 w-0.5 bg-[var(--bad)] opacity-70" title="Today" />
        </div>

        {/* Rows */}
        {rows.map((r) => {
          const v = variance(r, today);
          const ps = r.plannedStart ? toDay(r.plannedStart) : r.plannedEnd ? toDay(r.plannedEnd) : null;
          const pe = r.plannedEnd ? toDay(r.plannedEnd) : ps;
          const as = r.actualStart ? toDay(r.actualStart) : null;
          const ae = r.actualEnd ? toDay(r.actualEnd) : as !== null ? today : null;
          const late = v !== null && v > 0;
          const tone = late ? "var(--bad)" : r.done ? "var(--good)" : "var(--info)";
          const label = (
            <>
              <div className={`truncate ${r.level === 0 ? "font-medium" : ""}`}>{r.label}</div>
              {r.sub && <div className="truncate text-xs text-muted">{r.sub}</div>}
            </>
          );
          return (
            <div key={r.id} className="relative flex border-b border-line hover:bg-[var(--neutral-bg)]/40" style={{ height: ROW }}>
              <div style={{ width: LABEL_W, paddingLeft: r.level ? 32 : 16 }} className="sticky left-0 z-[5] flex shrink-0 flex-col justify-center border-r border-line bg-surface pr-3">
                {r.href ? <Link href={r.href} className="hover:underline">{label}</Link> : label}
              </div>
              <div style={{ width }} className="relative shrink-0">
                {ps !== null && pe !== null && (
                  <div title={`Planned: ${fmt(ps, { day: "numeric", month: "short" })} – ${fmt(pe, { day: "numeric", month: "short" })}`}
                    style={{ left: x(ps), width: Math.max((pe - ps + 1) * px, 4), top: 9 }}
                    className="absolute h-[11px] overflow-hidden rounded-sm border border-[var(--muted)] bg-[var(--neutral-bg)]">
                    {r.progress ? <div className="h-full bg-[var(--muted)] opacity-40" style={{ width: `${Math.round(r.progress * 100)}%` }} /> : null}
                  </div>
                )}
                {as !== null && ae !== null && (
                  <div title={`Actual: ${fmt(as, { day: "numeric", month: "short" })} – ${r.done ? fmt(ae, { day: "numeric", month: "short" }) : "ongoing"}`}
                    style={{ left: x(as), width: Math.max((ae - as + 1) * px, 4), top: 24, background: tone }}
                    className={`absolute h-[11px] rounded-sm ${r.done ? "" : "gantt-ongoing"}`} />
                )}
              </div>
              <div className="flex w-[90px] shrink-0 items-center px-2 text-xs tabular-nums">
                {v === null ? <span className="text-muted">{r.done ? "On time" : "—"}</span>
                  : v > 0 ? <span className="font-medium text-[var(--bad)]">{v}d late</span>
                  : v < 0 ? <span className="text-[var(--good)]">{-v}d early</span>
                  : <span className="text-[var(--good)]">On time</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GanttLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-sm border border-[var(--muted)] bg-[var(--neutral-bg)]" />Planned (shaded part = % complete)</span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-sm bg-[var(--good)]" />Actual, finished on time</span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-sm bg-[var(--info)]" />Actual, in progress</span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-sm bg-[var(--bad)]" />Running late</span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-0.5 bg-[var(--bad)]" />Today</span>
    </div>
  );
}
