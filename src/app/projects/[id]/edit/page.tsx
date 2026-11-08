import { notFound } from "next/navigation";
import { requireMe } from "@/lib/data";
import { PageTitle } from "@/components/ui";
import { ProjectForm } from "@/components/project-form";
import { ErrorNote } from "@/components/error-note";

export default async function EditProject({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase } = await requireMe();
  const [{ data: project }, { data: people }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("people").select("id,name,role").eq("active", true).order("name"),
  ]);
  if (!project) notFound();
  return (
    <>
      <PageTitle title={`Edit ${project.name}`} />
      <ErrorNote error={error} />
      <ProjectForm project={project} people={people ?? []} />
    </>
  );
}
