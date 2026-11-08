import { redirect } from "next/navigation";
import { requireMe, HOME } from "@/lib/data";
import { PageTitle, Card } from "@/components/ui";
import { ProjectList, type ProjectRow } from "@/components/project-list";

export default async function Home() {
  const { supabase, me } = await requireMe();
  const home = HOME[me.role];
  if (home) redirect(home);

  // Clients and consultants: their projects only.
  const { data } = await supabase
    .from("project_summary")
    .select("id,name,code,status,avg_progress,committed_spend,contract_value,planned_finish")
    .order("name");
  return (
    <>
      <PageTitle title={`Welcome, ${me.name}`} sub="Your projects with Beacon" />
      <Card><ProjectList projects={(data ?? []) as ProjectRow[]} showMoney={false} /></Card>
    </>
  );
}
