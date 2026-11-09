import { redirect } from "next/navigation";
import { requireMe, isInternal } from "@/lib/data";
import { loadProject } from "@/lib/project-db";
import { Database } from "@/components/database";
import { ProjectHeader } from "@/components/project-tabs";

export default async function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, me } = await requireMe();
  if (!isInternal(me.role)) redirect(`/projects/${id}`);
  const d = await loadProject(supabase, me, id, { tasks: true });
  return (
    <div className="full-bleed">
      <ProjectHeader id={id} name={d.project.name} code={d.project.code} current="tasks" internal />
      <Database id={`tasks:${id}`} table="site_tasks" rows={d.siteTasks.rows} columns={d.siteTasks.columns} titleKey="task"
        editable={d.canEditWork} createDefaults={{ project_id: id }} fieldsTable="site_tasks" canManageFields={me.role === "management"}
        initial={{ boardBy: "status" }} fullPage />
    </div>
  );
}
