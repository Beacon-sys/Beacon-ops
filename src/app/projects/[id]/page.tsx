import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe, isInternal, money, date } from "@/lib/data";
import { PageTitle, Card, Stat, Table, Badge, Progress } from "@/components/ui";
import { WorkItemForm, PurchaseRequestForm, SiteTaskForm } from "@/components/forms";
import { PurchaseTable, PURCHASE_SELECT, type PurchaseRow } from "@/components/purchase-table";
import { TaskTable, TASK_SELECT, type TaskRow } from "@/components/task-table";
import { ErrorNote } from "@/components/error-note";

export default async function ProjectPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, me } = await requireMe();
  const internal = isInternal(me.role);
  const back = `/projects/${id}`;

  const [{ data: summary }, { data: names }] = await Promise.all([
    supabase.from("project_summary").select("*").eq("id", id).maybeSingle(),
    supabase.from("projects")
      .select("client:people!projects_client_id_fkey(name), consultant:people!projects_consultant_id_fkey(name), pm:people!projects_project_manager_id_fkey(name)")
      .eq("id", id).maybeSingle(),
  ]);
  if (!summary) notFound();
  const p = { ...summary, ...(names ?? {}) };

  const { data: workItems = [] } = await supabase.from("work_item_summary")
    .select("*").eq("project_id", id).order("boq_ref", { nullsFirst: false }).order("name");

  const tenderOpen = me.role === "tendering" && p.status === "tendering";
  const canEditWork = me.role === "management" || me.role === "site_ops" || tenderOpen;
  const canRequest = ["management", "site_ops", "procurement"].includes(me.role);
  const showMoney = internal && me.role !== "site_ops";

  const [tasks, purchases, people] = internal
    ? await Promise.all([
        supabase.from("site_tasks").select(TASK_SELECT).eq("project_id", id).order("status").order("due", { nullsFirst: false }),
        supabase.from("purchases").select(PURCHASE_SELECT).eq("project_id", id).order("created_at", { ascending: false }),
        supabase.from("people").select("id,name,role").eq("active", true).order("name"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const everyone = people.data ?? [];
  const suppliers = everyone.filter((x) => x.role === "supplier");
  const wiOpts = (workItems ?? []).map((w) => ({ id: w.id, name: w.name, project_id: w.project_id }));

  const who = (x: unknown) => (x as { name: string } | null)?.name;

  return (
    <>
      <PageTitle
        title={p.name}
        sub={[p.code, p.location, who(p.client) && `Client: ${who(p.client)}`, who(p.consultant) && `Consultant: ${who(p.consultant)}`, who(p.pm) && `PM: ${who(p.pm)}`].filter(Boolean).join(" · ")}
        action={me.role === "management" || tenderOpen ? <Link className="btn" href={`${back}/edit`}>Edit project</Link> : null}
      />
      <ErrorNote error={error} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Status" value={<Badge set="project_status" value={p.status} />} />
        <Stat label="Progress" value={<Progress v={p.avg_progress} />} />
        <Stat label="Planned finish" value={date(p.planned_finish) || "—"} />
        {showMoney
          ? <Stat label="Committed / contract" value={<span className="text-base">{money(p.committed_spend)} <span className="text-muted">/ {money(p.contract_value) || "—"}</span></span>} />
          : <Stat label="Work items" value={p.work_item_count} />}
      </div>
      {showMoney && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Paid to date" value={money(p.paid_to_date)} />
          <Stat label="Open purchases" value={p.open_purchases} />
          <Stat label="Committed vs contract" value={p.contract_value ? `${Math.round((p.committed_spend / p.contract_value) * 1000) / 10}%` : "—"} />
          <Stat label="Work items" value={p.work_item_count} />
        </div>
      )}

      <Card title="Work items">
        <Table head={["Work item", "Trade", "Area", "Status", "Progress", "Planned finish", ...(showMoney ? ["Budget", "Committed"] : []), ...(internal ? ["Open tasks"] : []), ""]} empty={!workItems?.length}>
          {(workItems ?? []).map((w) => (
            <tr key={w.id}>
              <td>
                <div>{w.boq_ref && <span className="mr-2 text-muted">{w.boq_ref}</span>}{w.name}</div>
                {internal && !w.visible_to_client && <div className="text-xs text-muted">Hidden from client</div>}
              </td>
              <td><Badge set="trade" value={w.trade} /></td>
              <td>{w.area}</td>
              <td><Badge set="work_item_status" value={w.status} /></td>
              <td><Progress v={w.progress} /></td>
              <td>{date(w.planned_finish)}</td>
              {showMoney && <><td className="tabular-nums">{money(w.budget)}</td><td className="tabular-nums">{money(w.committed_spend)}</td></>}
              {internal && <td className="tabular-nums">{w.open_site_tasks}</td>}
              <td className="text-right">
                {canEditWork && (
                  <details className="relative inline-block text-left">
                    <summary className="btn btn-sm list-none">Edit</summary>
                    <div className="absolute right-0 z-10 mt-1 w-[min(90vw,640px)] rounded-xl border border-line bg-surface p-4 shadow-lg">
                      <WorkItemForm projectId={id} item={w} people={everyone} />
                    </div>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </Table>
        {canEditWork && (
          <details className="mt-4">
            <summary className="btn btn-sm list-none">+ Add work item</summary>
            <div className="mt-3"><WorkItemForm projectId={id} people={everyone} /></div>
          </details>
        )}
      </Card>

      {internal && (
        <>
          <Card title="Site tasks">
            <TaskTable rows={(tasks.data ?? []) as unknown as TaskRow[]} canEdit={canEditWork} back={back} showProject={false} />
            {canEditWork && (
              <details className="mt-4">
                <summary className="btn btn-sm list-none">+ Add site task</summary>
                <div className="mt-3"><SiteTaskForm projects={[]} workItems={wiOpts} people={everyone} projectId={id} back={back} /></div>
              </details>
            )}
          </Card>
          <Card title="Purchasing">
            <PurchaseTable rows={(purchases.data ?? []) as unknown as PurchaseRow[]} role={me.role} suppliers={suppliers} back={back} showProject={false} />
            {canRequest && (
              <details className="mt-4">
                <summary className="btn btn-sm list-none">+ Request materials</summary>
                <div className="mt-3"><PurchaseRequestForm projects={[]} workItems={wiOpts} suppliers={suppliers} projectId={id} back={back} /></div>
              </details>
            )}
          </Card>
        </>
      )}
    </>
  );
}
