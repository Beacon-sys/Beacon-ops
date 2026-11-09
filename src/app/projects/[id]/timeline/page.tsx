import { notFound } from "next/navigation";
import { requireMe, isInternal } from "@/lib/data";
import { ProjectHeader } from "@/components/project-tabs";
import { TimelineView } from "@/components/timeline-view";

export default async function ProjectTimeline({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ zoom?: string; show?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me } = await requireMe();
  const { data: project } = await supabase.from("projects").select("id,name,code").eq("id", id).maybeSingle();
  if (!project) notFound();
  return (
    <div className="full-bleed">
      <ProjectHeader id={id} name={project.name} code={project.code} current="timeline" internal={isInternal(me.role)} />
      <TimelineView projectId={id} sp={sp} base={`/projects/${id}/timeline`} />
    </div>
  );
}
