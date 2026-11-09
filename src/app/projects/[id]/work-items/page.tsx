import { requireMe } from "@/lib/data";
import { loadProject } from "@/lib/project-db";
import { Database } from "@/components/database";
import { ProjectHeader } from "@/components/project-tabs";

export default async function WorkItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, me } = await requireMe();
  const d = await loadProject(supabase, me, id);
  return (
    <div className="full-bleed">
      <ProjectHeader id={id} name={d.project.name} code={d.project.code} current="work-items" internal={d.internal} />
      <Database id={`work-items:${id}`} table="work_items" rows={d.work.rows} columns={d.work.columns} titleKey="name"
        href={d.internal ? "/work-items/:id" : undefined} editable={d.canEditWork} createDefaults={{ project_id: id }}
        fieldsTable="work_items" canManageFields={me.role === "management"} initial={{ group: "category" }} fullPage />
    </div>
  );
}
