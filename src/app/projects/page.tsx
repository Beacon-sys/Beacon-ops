import { requireMe, isInternal } from "@/lib/data";
import { T } from "@/components/i18n";
import { PageTitle, Card, ButtonLink } from "@/components/ui";
import { ProjectList, type ProjectRow } from "@/components/project-list";

export default async function Projects() {
  const { supabase, me } = await requireMe();
  const { data } = await supabase
    .from("project_summary")
    .select("id,name,code,status,avg_progress,committed_spend,contract_value,planned_finish")
    .order("name");
  return (
    <>
      <PageTitle
        title="Projects"
        action={["management", "tendering"].includes(me.role) ? <ButtonLink href="/projects/new"><T>{"New project"}</T></ButtonLink> : null}
      />
      <Card>
        <ProjectList projects={(data ?? []) as ProjectRow[]} showMoney={isInternal(me.role) && me.role !== "site_ops"} />
      </Card>
    </>
  );
}
