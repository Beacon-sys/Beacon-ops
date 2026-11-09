import Link from "next/link";
import { requireMe, label, EDITS_WORK } from "@/lib/data";
import { Card } from "@/components/ui";
import { GanttEditor, GanttLegend, type GRow as GanttRow, type Zoom } from "@/components/gantt-editor";
import type { Dep } from "@/lib/cpm";

type WI = { id: string; name: string; boq_ref: string | null; status: string; progress: number; planned_start: string | null;
  planned_finish: string | null; actual_start: string | null; actual_finish: string | null; project_id: string };
type ST = { id: string; task: string; status: string; type: string | null; work_item_id: string | null; project_id: string;
  planned_start: string | null; due: string | null; started_on: string | null; done_on: string | null; created_at: string };

/** Gantt for one project, or one row per project when projectId is "all". */
export async function TimelineView({ projectId, sp, base }: {
  projectId: string; sp: { zoom?: string; show?: string }; base: string;
}) {
  const { supabase, me } = await requireMe();
  const zoom: Zoom = sp.zoom === "week" || sp.zoom === "quarter" ? sp.zoom : "month";
  const show = sp.show === "work" || sp.show === "tasks" ? sp.show : "all";

  const { data: projects = [] } = await supabase.from("projects").select("id,name,status,start_date,planned_finish")
    .neq("status", "closed").order("name");
  const list = projects ?? [];
  const all = projectId === "all";

  const wiQ = supabase.from("work_items").select("id,name,boq_ref,status,progress,planned_start,planned_finish,actual_start,actual_finish,project_id")
    .order("planned_start", { nullsFirst: false }).order("name");
  const stQ = supabase.from("site_tasks").select("id,task,status,type,work_item_id,project_id,planned_start,due,started_on,done_on,created_at")
    .order("due", { nullsFirst: false });
  const [{ data: wis }, { data: sts }] = await Promise.all([
    all ? wiQ : wiQ.eq("project_id", projectId),
    all ? stQ : stQ.eq("project_id", projectId),
  ]);
  const workItems = (wis ?? []) as WI[];
  const tasks = (sts ?? []) as ST[];

  const wiRow = (w: WI): GanttRow => ({
    id: w.id, kind: "wi", level: 0, label: `${w.boq_ref ? w.boq_ref + "  " : ""}${w.name}`, sub: `${label("work_item_status", w.status)} · ${Math.round(Number(w.progress) * 100)}%`,
    href: `/work-items/${w.id}`, plannedStart: w.planned_start, plannedEnd: w.planned_finish,
    actualStart: w.actual_start, actualEnd: w.status === "done" ? w.actual_finish : null, done: w.status === "done", progress: Number(w.progress),
  });
  const stRow = (t: ST, level: 0 | 1): GanttRow => ({
    id: t.id, kind: "task", level, label: t.task, sub: [label("site_task_status", t.status), t.type && label("site_task_type", t.type)].filter(Boolean).join(" · "),
    href: `/projects/${t.project_id}`, plannedStart: t.planned_start ?? (t.due ? t.created_at.slice(0, 10) : null), plannedEnd: t.due,
    actualStart: t.started_on, actualEnd: t.status === "done" ? t.done_on : null, done: t.status === "done",
  });

  let rows: GanttRow[] = [];
  if (all) {
    // One row per project: planned from project dates, actual from its work items.
    rows = list.map((p) => {
      const ws = workItems.filter((w) => w.project_id === p.id);
      const starts = ws.map((w) => w.actual_start).filter(Boolean).sort() as string[];
      const done = ws.length > 0 && ws.every((w) => w.status === "done");
      const ends = ws.map((w) => w.actual_finish).filter(Boolean).sort() as string[];
      const prog = ws.length ? ws.reduce((s, w) => s + Number(w.progress), 0) / ws.length : null;
      return {
        id: p.id, kind: "project" as const, level: 0 as const, label: p.name, sub: `${label("project_status", p.status)}${prog !== null ? ` · ${Math.round(prog * 100)}%` : ""}`,
        href: `/projects/${p.id}/timeline?zoom=${zoom}`, plannedStart: p.start_date, plannedEnd: p.planned_finish,
        actualStart: starts[0] ?? null, actualEnd: done ? ends[ends.length - 1] ?? null : null, done, progress: prog,
      };
    });
  } else {
    if (show !== "tasks") {
      for (const w of workItems) {
        rows.push(wiRow(w));
        if (show === "all") tasks.filter((t) => t.work_item_id === w.id).forEach((t) => rows.push(stRow(t, 1)));
      }
    }
    const loose = tasks.filter((t) => show === "tasks" || !t.work_item_id || !workItems.some((w) => w.id === t.work_item_id));
    if (show !== "work") loose.forEach((t) => rows.push(stRow(t, show === "tasks" ? 0 : 1)));
  }
  rows = rows.filter((r) => r.plannedEnd || r.actualStart);

  const today = new Date().toISOString().slice(0, 10);
  const late = rows.filter((r) => !r.done && r.plannedEnd && r.plannedEnd < today).length;
  const wiIds = workItems.map((w) => w.id);
  const [{ data: depRows }, { data: ms }] = all
    ? [{ data: [] }, { data: [] }]
    : await Promise.all([
        wiIds.length ? supabase.from("work_item_dependencies").select("predecessor_id,successor_id,kind,lag_days").in("successor_id", wiIds) : Promise.resolve({ data: [] }),
        supabase.from("milestones").select("id,name,planned_date,actual_date").eq("project_id", projectId).order("planned_date"),
      ]);
  const deps: Dep[] = ((depRows ?? []) as { predecessor_id: string; successor_id: string; kind: Dep["kind"]; lag_days: number }[])
    .map((d) => ({ pred: d.predecessor_id, succ: d.successor_id, kind: d.kind, lag: d.lag_days }));
  const q = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ zoom, show, ...patch });
    return `${base}?${p}`;
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!all && (
          <div className="flex gap-1">
            {[["all", "Work items + tasks"], ["work", "Work items"], ["tasks", "Site tasks"]].map(([k, l]) => (
              <Link key={k} href={q({ show: k })} className={`btn btn-sm ${show === k ? "btn-primary" : ""}`}>{l}</Link>
            ))}
          </div>
        )}
        <div className="ml-auto flex gap-1">
          {(["week", "month", "quarter"] as Zoom[]).map((z) => (
            <Link key={z} href={q({ zoom: z })} className={`btn btn-sm ${zoom === z ? "btn-primary" : ""}`}>{z[0].toUpperCase() + z.slice(1)}</Link>
          ))}
        </div>
      </div>
      <Card title={`${rows.length} ${all ? "projects" : "items"}${late ? ` · ${late} running late` : ""}`}
>
        <GanttLegend />
        <GanttEditor rows={rows} deps={deps} milestones={ms ?? []} zoom={zoom}
          editable={!all && EDITS_WORK.includes(me.role)} projectId={all ? null : projectId} />
      </Card>
    </>
  );
}
