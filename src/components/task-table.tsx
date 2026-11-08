import { setSiteTaskStatus } from "@/app/actions";
import { date } from "@/lib/data";
import { Table, Badge } from "@/components/ui";

export type TaskRow = {
  id: string; task: string; type: string | null; due: string | null; priority: string; status: string;
  done_on: string | null; project?: { name: string } | null; assignee?: { name: string } | null; work_item?: { name: string } | null;
};

const MOVES: Record<string, { to: string; label: string }[]> = {
  to_do: [{ to: "in_progress", label: "Start" }, { to: "done", label: "Done" }],
  in_progress: [{ to: "done", label: "Done" }, { to: "blocked", label: "Blocked" }],
  blocked: [{ to: "in_progress", label: "Unblock" }],
  done: [{ to: "to_do", label: "Reopen" }],
};

export function TaskTable({ rows, canEdit, back, showProject = true }: {
  rows: TaskRow[]; canEdit: boolean; back: string; showProject?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Table head={["Task", ...(showProject ? ["Project"] : []), "Assigned", "Due", "Priority", "Status", ""]} empty={!rows.length}>
      {rows.map((t) => (
        <tr key={t.id}>
          <td>
            <div>{t.task}</div>
            <div className="text-xs text-muted">{[t.work_item?.name, t.type && <Badge key="t" set="site_task_type" value={t.type} />].filter(Boolean).map((x, i) => <span key={i} className="mr-2">{x}</span>)}</div>
          </td>
          {showProject && <td className="text-muted">{t.project?.name}</td>}
          <td>{t.assignee?.name}</td>
          <td className={t.status !== "done" && t.due && t.due < today ? "text-[var(--bad)]" : ""}>
            {t.status === "done" ? <span className="text-muted">Done {date(t.done_on)}</span> : date(t.due)}
          </td>
          <td><Badge set="priority" value={t.priority} /></td>
          <td><Badge set="site_task_status" value={t.status} /></td>
          <td className="whitespace-nowrap text-right">
            {canEdit && (MOVES[t.status] ?? []).map((m) => (
              <form key={m.to} action={setSiteTaskStatus} className="ml-1 inline">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="status" value={m.to} />
                <button className="btn btn-sm">{m.label}</button>
              </form>
            ))}
          </td>
        </tr>
      ))}
    </Table>
  );
}

export const TASK_SELECT =
  "id,task,type,due,priority,status,done_on,project:projects(name),assignee:people!site_tasks_assigned_to_id_fkey(name),work_item:work_items(name)";
