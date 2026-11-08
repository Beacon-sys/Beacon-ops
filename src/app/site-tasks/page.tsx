import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMe } from "@/lib/data";
import { PageTitle, Card } from "@/components/ui";
import { TaskTable, TASK_SELECT, type TaskRow } from "@/components/task-table";
import { SiteTaskForm } from "@/components/forms";
import { ErrorNote } from "@/components/error-note";

export default async function SiteTasks({ searchParams }: { searchParams: Promise<{ view?: string; error?: string }> }) {
  const { supabase, me } = await requireMe();
  if (!["management", "site_ops"].includes(me.role)) redirect("/");
  const sp = await searchParams;
  const view = sp.view === "all" ? "all" : sp.view === "mine" ? "mine" : "open";
  const back = `/site-tasks?view=${view}`;

  let q = supabase.from("site_tasks").select(TASK_SELECT);
  if (view === "open") q = q.neq("status", "done");
  if (view === "mine") q = q.eq("assigned_to_id", me.id).neq("status", "done");
  const [rows, projects, workItems, people] = await Promise.all([
    q.order("due", { nullsFirst: false }),
    supabase.from("projects").select("id,name").order("name"),
    supabase.from("work_items").select("id,name,project_id").order("name"),
    supabase.from("people").select("id,name,role").eq("active", true).order("name"),
  ]);

  return (
    <>
      <PageTitle title="Site tasks" />
      <ErrorNote error={sp.error} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[["mine", "My tasks"], ["open", "All open"], ["all", "Everything"]].map(([k, l]) => (
          <Link key={k} href={`/site-tasks?view=${k}`} className={`btn btn-sm ${k === view ? "btn-primary" : ""}`}>{l}</Link>
        ))}
      </div>
      <Card><TaskTable rows={(rows.data ?? []) as unknown as TaskRow[]} canEdit back={back} /></Card>
      <Card title="Add a site task">
        <SiteTaskForm projects={projects.data ?? []} workItems={workItems.data ?? []} people={people.data ?? []} back={back} />
      </Card>
    </>
  );
}
