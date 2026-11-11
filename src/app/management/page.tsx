import Link from "next/link";
import { T } from "@/components/i18n";
import { redirect } from "next/navigation";
import { requireMe, date } from "@/lib/data";
import { PageTitle, Stat, Card, Table, Badge } from "@/components/ui";
import { ProjectList, type ProjectRow } from "@/components/project-list";

type Named = { name: string } | null;

export default async function Management() {
  const { supabase, me } = await requireMe();
  const { data } = await supabase
    .from("project_summary")
    .select("id,name,code,status,avg_progress,committed_spend,contract_value,planned_finish")
    .order("name");
  const projects = (data ?? []) as ProjectRow[];

  if (me.role !== "management") redirect("/");

  const today = new Date().toISOString().slice(0, 10);
  const [tasks, overdue, purchases, openPurchases] = await Promise.all([
    supabase.from("site_tasks").select("id,task,due,status,project:projects(name)")
      .neq("status", "done").order("due", { nullsFirst: false }).limit(8),
    supabase.from("site_tasks").select("id", { count: "exact", head: true })
      .neq("status", "done").lt("due", today),
    supabase.from("purchases").select("id,request,status,needed_by,project:projects(name)")
      .not("status", "in", "(delivered,rejected)").order("needed_by", { nullsFirst: false }).limit(8),
    supabase.from("purchases").select("id", { count: "exact", head: true })
      .not("status", "in", "(delivered,rejected)"),
  ]);
  const openTasks = await supabase.from("site_tasks").select("id", { count: "exact", head: true }).neq("status", "done");

  return (
    <>
      <PageTitle title="Management" sub="What needs attention across Beacon's projects" />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active projects" value={projects.filter((p) => p.status === "active").length} />
        <Stat label="Open site tasks" value={openTasks.count ?? 0} />
        <Stat label="Overdue tasks" value={overdue.count ?? 0} />
        <Stat label="Open purchases" value={openPurchases.count ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Upcoming site tasks" action={<Link className="link text-sm" href="/operations"><T>{"Operations"}</T></Link>}>
          <Table head={["Task", "Project", "Due", "Status"]} empty={!tasks.data?.length}>
            {(tasks.data ?? []).map((t) => (
              <tr key={t.id}>
                <td>{t.task}</td>
                <td className="text-muted">{(t.project as unknown as Named)?.name}</td>
                <td className={t.due && t.due < today ? "text-[var(--bad)]" : ""}>{date(t.due)}</td>
                <td><Badge set="site_task_status" value={t.status} /></td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Open purchases" action={<Link className="link text-sm" href="/procurement"><T>{"Procurement"}</T></Link>}>
          <Table head={["Request", "Project", "Needed by", "Status"]} empty={!purchases.data?.length}>
            {(purchases.data ?? []).map((x) => (
              <tr key={x.id}>
                <td>{x.request}</td>
                <td className="text-muted">{(x.project as unknown as Named)?.name}</td>
                <td className={x.needed_by && (new Date(x.needed_by).getTime() - Date.now()) / 86400000 < 3 ? "text-[var(--bad)]" : ""}>{date(x.needed_by)}</td>
                <td><Badge set="purchase_status" value={x.status} /></td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card title="Projects" action={<Link className="link text-sm" href="/projects"><T>{"All projects"}</T></Link>}>
        <ProjectList projects={projects} showMoney />
      </Card>
    </>
  );
}
