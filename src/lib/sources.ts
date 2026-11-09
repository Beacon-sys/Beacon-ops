// Databases that a page's linked view can show, loaded with columns and the viewer's edit rights.
import type { Column, Row } from "@/components/database";
import { LABELS, SEES_COST, isInternal, type Me } from "@/lib/data";
import { workItemColumns, taskColumns, purchaseColumns, submittalColumns, contractColumns, vendorColumns, meetingColumns } from "@/lib/db-columns";
import { loadMeetings } from "@/lib/meetings";
import { withCustomFields } from "@/lib/custom-fields";
import { PURCHASE_ROWS, purchaseRow } from "@/lib/project-db";
import type { createClient } from "@/lib/supabase/server";

type DB = Awaited<ReturnType<typeof createClient>>;
export const SOURCES = {
  work_items: "Work items", site_tasks: "Site tasks", purchases: "Purchases",
  submittals: "Submittals", meetings: "Meetings", contracts: "Contracts", vendors: "Vendors & contractors",
} as const;
export type Source = keyof typeof SOURCES;

export type Loaded = {
  table: string; titleKey: string; columns: Column[]; rows: Row[]; href?: string;
  editable: boolean; creatable: boolean; createDefaults?: Record<string, string | number | boolean | null>;
  fieldsTable?: string;
};

const nm = (x: unknown) => (x as { name: string } | null)?.name;
const projectCol: Column = { key: "project_name", label: "Project", type: "text" };
// Put the project column right after the title when a view spans every project.
const withProject = (cols: Column[], titleKey: string, on: boolean) => {
  if (!on) return cols;
  const i = cols.findIndex((c) => c.key === titleKey);
  return cols.some((c) => c.key === "project_name") ? cols : [...cols.slice(0, i + 1), projectCol, ...cols.slice(i + 1)];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadSource(supabase: DB, me: Me, source: Source, projectId: string | null): Promise<Loaded | null> {
  if (!isInternal(me.role)) return null;
  const all = !projectId;
   
  const scope = (q: any) => (projectId ? q.eq("project_id", projectId) : q);
  const [{ data: projects }, { data: people }] = await Promise.all([
    supabase.from("projects").select("id,name"),
    supabase.from("people").select("id,name,role").eq("active", true).order("name"),
  ]);
  const pname = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const everyone = people ?? [];
  const suppliers = everyone.filter((p) => p.role === "supplier" || p.role === "contractor");
  const defaults = projectId ? { project_id: projectId } : undefined;
  const mgr = me.role === "management";

  switch (source) {
    case "work_items": {
      const { data } = await scope(supabase.from("work_item_summary").select("*"))
        .order("category", { nullsFirst: false }).order("boq_ref", { nullsFirst: false });
      const rows = (data ?? []).map((w: Record<string, any>) => ({ ...w, project_name: pname.get(w.project_id) })) as Row[];
      const db = await withCustomFields(supabase, "work_items", withProject(workItemColumns(me.role, SEES_COST.includes(me.role)), "name", all), rows);
      const can = ["management", "site_ops", "tendering"].includes(me.role);
      return { table: "work_items", titleKey: "name", ...db, href: "/work-items/:id", editable: can, creatable: can && !all, createDefaults: defaults, fieldsTable: mgr ? "work_items" : undefined };
    }
    case "site_tasks": {
      const [{ data }, { data: wi }] = await Promise.all([
        scope(supabase.from("site_tasks").select("*, assignee:people!site_tasks_assigned_to_id_fkey(name), work_item:work_items(name)")).order("due", { nullsFirst: false }),
        scope(supabase.from("work_items").select("id,name")),
      ]);
      const rows = (data ?? []).map((t: Record<string, any>) => ({ ...t, project_name: pname.get(t.project_id), assignee_name: nm(t.assignee), work_item_name: nm(t.work_item) })) as Row[];
      const db = await withCustomFields(supabase, "site_tasks", taskColumns(everyone, wi ?? [], all), rows);
      const can = ["management", "site_ops"].includes(me.role);
      return { table: "site_tasks", titleKey: "task", ...db, editable: can, creatable: can && !all, createDefaults: defaults, fieldsTable: mgr ? "site_tasks" : undefined };
    }
    case "purchases": {
      const [{ data }, { data: wi }] = await Promise.all([
        scope(supabase.from("purchases").select(PURCHASE_ROWS)).order("created_at", { ascending: false }),
        scope(supabase.from("work_items").select("id,name")),
      ]);
      const rows = ((data ?? []) as Record<string, unknown>[]).map(purchaseRow);
      const db = await withCustomFields(supabase, "purchases", purchaseColumns(me.role, suppliers, wi ?? [], all), rows);
      return { table: "purchases", titleKey: "request", ...db, editable: ["management", "procurement", "accountant"].includes(me.role),
        creatable: !all && ["management", "procurement", "site_ops"].includes(me.role), createDefaults: defaults, fieldsTable: mgr ? "purchases" : undefined };
    }
    case "submittals": {
      const { data } = await scope(supabase.from("submittals").select("*, items:work_item_submittals(work_item:work_items(name,boq_ref))")).order("number", { nullsFirst: false });
      type It = { work_item: { name: string; boq_ref: string | null } | null };
      const rows = (data ?? []).map((x: Record<string, any>) => ({ ...x, project_name: pname.get(x.project_id),
        work_items_text: ((x.items ?? []) as It[]).map((i) => i.work_item && (i.work_item.boq_ref ?? i.work_item.name)).filter(Boolean).join(", ") })) as Row[];
      const db = await withCustomFields(supabase, "submittals", submittalColumns(all), rows);
      const can = ["management", "site_ops", "tendering", "procurement"].includes(me.role);
      return { table: "submittals", titleKey: "title", ...db, editable: can, creatable: can && !all, createDefaults: defaults, fieldsTable: mgr ? "submittals" : undefined };
    }
    case "meetings": {
      const can = ["management", "site_ops", "tendering"].includes(me.role);
      return { table: "meetings", titleKey: "title", columns: meetingColumns(all), rows: await loadMeetings(supabase, projectId), href: "/meetings/:id",
        editable: can, creatable: can && !all, createDefaults: defaults };
    }
    case "contracts": {
      const { data } = await scope(supabase.from("contract_summary").select("*")).order("created_at", { ascending: false });
      const vname = new Map(everyone.map((p) => [p.id, p.name]));
      const rows = (data ?? []).map((c: Record<string, any>) => ({ ...c, project_name: pname.get(c.project_id), vendor_name: vname.get(c.vendor_id) })) as Row[];
      return { table: "contracts", titleKey: "title", columns: contractColumns(), rows, href: "/procurement/contracts/:id",
        editable: ["management", "procurement"].includes(me.role), creatable: false };
    }
    case "vendors": {
      const [{ data }, { data: sums }] = await Promise.all([
        supabase.from("people").select("*").in("role", ["supplier", "contractor"]).order("name"),
        supabase.from("vendor_summary").select("*"),
      ]);
      const sum = new Map((sums ?? []).map((x) => [x.id, x]));
      const rows = (data ?? []).map((v) => {
        const x = sum.get(v.id);
        return { ...v, rating: v.rating ? String(v.rating) : null, orders: x?.orders ?? 0, ordered_value: x?.ordered_value ?? 0, last_order: x?.last_order ?? null,
          trades_text: ((v.trades ?? []) as string[]).map((t) => LABELS.trade[t as keyof typeof LABELS.trade] ?? t).join(", ") };
      }) as Row[];
      const can = ["management", "procurement"].includes(me.role);
      return { table: "people", titleKey: "name", columns: vendorColumns(), rows, href: "/procurement/vendors/:id", editable: can, creatable: can, createDefaults: { role: "supplier" } };
    }
  }
}
