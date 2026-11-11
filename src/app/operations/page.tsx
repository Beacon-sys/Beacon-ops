import { redirect } from "next/navigation";
import { T } from "@/components/i18n";
import Link from "next/link";
import { requireMe, allowed } from "@/lib/data";
import { PageTitle, Card } from "@/components/ui";
import { Database, type Row } from "@/components/database";
import { taskColumns } from "@/lib/db-columns";
import { withCustomFields } from "@/lib/custom-fields";
import { SiteTaskForm, PurchaseRequestForm } from "@/components/forms";
import { ProjectList, type ProjectRow } from "@/components/project-list";
import { ErrorNote } from "@/components/error-note";

export default async function Operations({ searchParams }: { searchParams: Promise<{ view?: string; error?: string }> }) {
  const { supabase, me } = await requireMe();
  if (!allowed(me.role, ["site_ops"])) redirect("/");
  const sp = await searchParams;
  const view = sp.view === "all" ? "all" : sp.view === "mine" ? "mine" : "open";
  const back = `/operations?view=${view}`;

  let q = supabase.from("site_tasks").select("*, project:projects(name), assignee:people!site_tasks_assigned_to_id_fkey(name), work_item:work_items(name)");
  if (view === "open") q = q.neq("status", "done");
  if (view === "mine") q = q.eq("assigned_to_id", me.id).neq("status", "done");
  const [rows, projects, workItems, people, active, suppliers] = await Promise.all([
    q.order("due", { nullsFirst: false }),
    supabase.from("projects").select("id,name").order("name"),
    supabase.from("work_items").select("id,name,project_id").order("name"),
    supabase.from("people").select("id,name,role").eq("active", true).order("name"),
    supabase.from("project_summary").select("id,name,code,status,avg_progress,committed_spend,contract_value,planned_finish")
      .in("status", ["active", "on_hold"]).order("name"),
    supabase.from("people").select("id,name").in("role", ["supplier", "contractor"]).eq("active", true).order("name"),
  ]);

  const nm = (x: unknown) => (x as { name: string } | null)?.name;
  const taskRows = (rows.data ?? []).map((t) => ({ ...t, project_name: nm(t.project), assignee_name: nm(t.assignee), work_item_name: nm(t.work_item) })) as Row[];

  const db = await withCustomFields(supabase, "site_tasks", taskColumns(people.data ?? [], workItems.data ?? [], true), taskRows);

  return (
    <>
      <PageTitle title="Operations" sub="Projects on site, site tasks and material requests" />
      <ErrorNote error={sp.error} />
      <Card title="Projects on site"><ProjectList projects={(active.data ?? []) as ProjectRow[]} showMoney={false} /></Card>
      <h2 className="mb-3 text-lg font-semibold"><T>{"Site tasks"}</T></h2>
      <div className="mb-4 flex flex-wrap gap-2">
        {[["mine", "My tasks"], ["open", "All open"], ["all", "Everything"]].map(([k, l]) => (
          <Link key={k} href={`/operations?view=${k}`} className={`btn btn-sm ${k === view ? "btn-primary" : ""}`}><T>{l}</T></Link>
        ))}
      </div>
      <Card><Database id={`ops-tasks:${view}`} table="site_tasks" rows={db.rows} titleKey="task" editable creatable={false}
        columns={db.columns} fieldsTable="site_tasks" canManageFields={me.role === "management"} initial={{ boardBy: "status", group: "project_name" }} views={["table", "board", "timeline", "calendar", "list"]} /></Card>
      <Card title="Request materials" id="request">
        <PurchaseRequestForm projects={projects.data ?? []} workItems={workItems.data ?? []} suppliers={suppliers.data ?? []} back={back} />
      </Card>
      <Card title="Add a site task">
        <SiteTaskForm projects={projects.data ?? []} workItems={workItems.data ?? []} people={people.data ?? []} back={back} />
      </Card>
    </>
  );
}
