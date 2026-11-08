import { requireMe } from "@/lib/data";
import { PageTitle } from "@/components/ui";
import { ProjectForm } from "@/components/project-form";
import { ErrorNote } from "@/components/error-note";

export default async function NewProject({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, me } = await requireMe();
  const { error } = await searchParams;
  const { data: people } = await supabase.from("people").select("id,name,role").eq("active", true).order("name");
  return (
    <>
      <PageTitle title="New project" />
      <ErrorNote error={error} />
      <ProjectForm people={people ?? []} tendering={me.role === "tendering"} />
    </>
  );
}
