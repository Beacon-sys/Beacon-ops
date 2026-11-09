// Loads one project's databases (work items, site tasks, purchases) with their columns and custom fields.
import { notFound } from "next/navigation";
import type { Row } from "@/components/database";
import { isInternal, SEES_COST, type Me } from "@/lib/data";
import { workItemColumns, taskColumns, purchaseColumns } from "@/lib/db-columns";
import { withCustomFields } from "@/lib/custom-fields";
import type { createClient } from "@/lib/supabase/server";

type DB = Awaited<ReturnType<typeof createClient>>;
const who = (x: unknown) => (x as { name: string } | null)?.name;

export async function loadProject(supabase: DB, me: Me, id: string, want: { tasks?: boolean; purchases?: boolean } = {}) {
  const internal = isInternal(me.role);
  const [{ data: project }, { data: workItems }, people] = await Promise.all([
    supabase.from("projects").select("id,name,code,status").eq("id", id).maybeSingle(),
    supabase.from("work_item_summary").select("*").eq("project_id", id)
      .order("category", { nullsFirst: false }).order("boq_ref", { nullsFirst: false }).order("name"),
    internal ? supabase.from("people").select("id,name,role").eq("active", true).order("name") : Promise.resolve({ data: [] as { id: string; name: string; role: string }[] }),
  ]);
  if (!project) notFound();
  const everyone = people.data ?? [];
  const suppliers = everyone.filter((x) => x.role === "supplier" || x.role === "contractor");
  const wiOpts = (workItems ?? []).map((w) => ({ id: w.id as string, name: w.name as string, project_id: w.project_id as string }));

  const tenderOpen = me.role === "tendering" && project.status === "tendering";
  const canEditWork = me.role === "management" || me.role === "site_ops" || tenderOpen;
  const canBuy = ["management", "procurement", "accountant"].includes(me.role);

  const [tasks, purchases] = await Promise.all([
    internal && want.tasks
      ? supabase.from("site_tasks").select("*, assignee:people!site_tasks_assigned_to_id_fkey(name), work_item:work_items(name)").eq("project_id", id).order("status").order("due", { nullsFirst: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    internal && want.purchases
      ? supabase.from("purchases").select("*, supplier:people!purchases_supplier_id_fkey(name), work_item:work_items(name)").eq("project_id", id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const taskRows = (tasks.data ?? []).map((t) => ({ ...t, assignee_name: who(t.assignee), work_item_name: who(t.work_item) })) as Row[];
  const purchaseRows = (purchases.data ?? []).map((x) => ({ ...x, supplier_name: who(x.supplier), work_item_name: who(x.work_item) })) as Row[];

  const empty = { columns: [], rows: [] };
  const [work, siteTasks, buying] = await Promise.all([
    withCustomFields(supabase, "work_items", workItemColumns(me.role, SEES_COST.includes(me.role)), (workItems ?? []) as Row[], true, !internal),
    internal && want.tasks ? withCustomFields(supabase, "site_tasks", taskColumns(everyone, wiOpts), taskRows) : empty,
    internal && want.purchases ? withCustomFields(supabase, "purchases", purchaseColumns(me.role, suppliers, wiOpts), purchaseRows) : empty,
  ]);
  return { project, internal, everyone, suppliers, wiOpts, workItems: workItems ?? [], canEditWork, canBuy, tenderOpen, work, siteTasks, buying };
}

/** Purchases with the names needed by the purchases database. */
export const PURCHASE_ROWS = "*, project:projects(name), supplier:people!purchases_supplier_id_fkey(name), work_item:work_items(name)";
export const purchaseRow = (x: Record<string, unknown>): Row => ({ ...x, id: String(x.id), project_name: who(x.project), supplier_name: who(x.supplier), work_item_name: who(x.work_item) });
