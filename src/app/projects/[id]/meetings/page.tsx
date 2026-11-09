import { notFound, redirect } from "next/navigation";
import { requireMe, isInternal } from "@/lib/data";
import { ProjectHeader } from "@/components/project-tabs";
import { Database } from "@/components/database";
import { meetingColumns } from "@/lib/db-columns";
import { loadMeetings } from "@/lib/meetings";

export default async function ProjectMeetings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, me } = await requireMe();
  if (!isInternal(me.role)) redirect(`/projects/${id}`);
  const { data: project } = await supabase.from("projects").select("id,name,code").eq("id", id).maybeSingle();
  if (!project) notFound();
  const rows = await loadMeetings(supabase, id);
  const can = ["management", "site_ops", "tendering"].includes(me.role);
  return (
    <div className="full-bleed">
      <ProjectHeader id={id} name={project.name} code={project.code} current="meetings" internal />
      <Database id={`meetings:${id}`} table="meetings" rows={rows} columns={meetingColumns()} titleKey="title" href="/meetings/:id"
        editable={can} createDefaults={{ project_id: id }} views={["table", "calendar", "list"]} fullPage />
      <p className="mt-2 text-xs text-muted">Add a meeting, then click Open on it to write the notes and add its actions.</p>
    </div>
  );
}
