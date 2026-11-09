import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMe, isInternal, date, label, LABELS } from "@/lib/data";
import { ProjectHeader } from "@/components/project-tabs";
import { Database, type Row } from "@/components/database";
import { taskColumns } from "@/lib/db-columns";
import { withCustomFields } from "@/lib/custom-fields";
import { MeetingNotes } from "@/components/meeting-notes";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, me } = await requireMe();
  if (!isInternal(me.role)) redirect("/");
  const { data: m } = await supabase.from("meetings").select("*, project:projects(id,name,code)").eq("id", id).maybeSingle();
  if (!m) notFound();
  const project = m.project as { id: string; name: string; code: string | null };
  const [{ data: tasks }, { data: people }, { data: wi }] = await Promise.all([
    supabase.from("site_tasks").select("*, assignee:people!site_tasks_assigned_to_id_fkey(name), work_item:work_items(name)").eq("meeting_id", id).order("created_at"),
    supabase.from("people").select("id,name,role").eq("active", true).order("name"),
    supabase.from("work_items").select("id,name").eq("project_id", project.id).order("name"),
  ]);
  const nm = (x: unknown) => (x as { name: string } | null)?.name;
  const rows = (tasks ?? []).map((t) => ({ ...t, assignee_name: nm(t.assignee), work_item_name: nm(t.work_item) })) as Row[];
  // People who can be given actions: staff, plus this project's client and consultant and any contractor.
  const db = await withCustomFields(supabase, "site_tasks", taskColumns(people ?? [], wi ?? []), rows);
  const can = ["management", "site_ops", "tendering"].includes(me.role);

  return (
    <div className="full-bleed">
      <ProjectHeader id={project.id} name={project.name} code={project.code} current="meetings" internal />
      <div className="mb-1 text-xs text-muted"><Link className="hover:underline" href={`/projects/${project.id}/meetings`}>Meetings</Link> / {date(m.meeting_date)}</div>
      <MeetingNotes meeting={m} editable={can} kindLabel={label("meeting_kind", m.kind)} kinds={Object.entries(LABELS.meeting_kind)} />
      <h2 className="mb-2 mt-8 text-lg font-semibold">Actions</h2>
      <p className="mb-3 text-sm text-muted">Each action is a site task on this project. Assign it to a person; actions for the client or consultant also appear in their action tracker.</p>
      <Database id={`meeting-actions:${id}`} table="site_tasks" rows={db.rows} columns={db.columns} titleKey="task"
        editable={can} createDefaults={{ project_id: project.id, meeting_id: id }} views={["table", "board", "list"]}
        initial={{ hidden: ["type", "work_item_id", "planned_start", "started_on", "done_on", "notes"] }} />
    </div>
  );
}
