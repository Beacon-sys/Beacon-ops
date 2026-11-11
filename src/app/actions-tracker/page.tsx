import { redirect } from "next/navigation";
import { requireMe, isInternal } from "@/lib/data";
import { PageTitle, Card } from "@/components/ui";
import { Database, type Column, type Row } from "@/components/database";
import { taskColumns } from "@/lib/db-columns";

// Actions owned by clients and consultants, usually from meetings.
// Staff see every project; a client or consultant sees only their own projects (row-level security).
export default async function ActionTracker() {
  const { supabase, me } = await requireMe();
  const internal = isInternal(me.role);
  if (!internal && !["client", "consultant"].includes(me.role)) redirect("/");
  const [{ data }, { data: people }] = await Promise.all([
    supabase.from("site_tasks").select("*, project:projects(name), meeting:meetings(title,meeting_date), assignee:people!site_tasks_assigned_to_id_fkey(name)")
      .in("party", ["client", "consultant"]).order("status").order("due", { nullsFirst: false }),
    internal ? supabase.from("people").select("id,name").eq("active", true).order("name") : Promise.resolve({ data: [] }),
  ]);
  const nm = (x: unknown) => (x as { name: string } | null)?.name;
  const rows = (data ?? []).map((t) => {
    const m = t.meeting as { title: string; meeting_date: string } | null;
    return { ...t, project_name: nm(t.project), assignee_name: nm(t.assignee), meeting_title: m ? `${m.title} (${m.meeting_date})` : null };
  }) as Row[];
  const base = taskColumns(people ?? [], [], true).filter((c) => !["type", "work_item_id", "planned_start", "started_on"].includes(c.key));
  const meetingCol: Column = { key: "meeting_title", label: "From meeting", type: "text", translate: true };
  const columns = [...base.slice(0, 2), meetingCol, ...base.slice(2)]
    .map((c) => (internal ? c : { ...c, editable: false }));
  return (
    <>
      <PageTitle title={internal ? "Client & consultant actions" : "Action tracker"}
        sub={internal ? "Actions the client or consultant owe, across all projects" : "Actions waiting on your side, from our meetings"} />
      <Card>
        <Database id="actions-tracker" table="site_tasks" rows={rows} columns={columns} titleKey="task"
          editable={internal && ["management", "site_ops"].includes(me.role)} creatable={false}
          initial={{ group: "project_name", boardBy: "status" }} views={["table", "board", "list"]} />
      </Card>
    </>
  );
}
