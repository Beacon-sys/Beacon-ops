import { redirect } from "next/navigation";
import { T } from "@/components/i18n";
import Link from "next/link";
import { requireMe, allowed } from "@/lib/data";
import { PageTitle, Card } from "@/components/ui";
import { Database, type Row } from "@/components/database";
import { purchaseColumns } from "@/lib/db-columns";
import { withCustomFields } from "@/lib/custom-fields";
import { PURCHASE_ROWS, purchaseRow } from "@/lib/project-db";
import { PurchaseRequestForm } from "@/components/forms";
import { ErrorNote } from "@/components/error-note";

const VIEWS: Record<string, { label: string; apply: (q: any) => any }> = { // eslint-disable-line @typescript-eslint/no-explicit-any
  open: { label: "Open requests", apply: (q) => q.not("status", "in", "(delivered,rejected)") },
  approval: { label: "Needs approval", apply: (q) => q.in("status", ["requested", "getting_quotes"]) },
  to_pay: { label: "To pay", apply: (q) => q.neq("status", "rejected").neq("payment_status", "paid").in("status", ["po_issued", "delivered"]) },
  all: { label: "All", apply: (q) => q },
};

export default async function Procurement({ searchParams }: { searchParams: Promise<{ view?: string; error?: string }> }) {
  const { supabase, me } = await requireMe();
  if (!allowed(me.role, ["procurement"])) redirect("/");
  const sp = await searchParams;
  const view = sp.view && VIEWS[sp.view] ? sp.view : "open";
  const back = `/procurement?view=${view}`;

  const [rows, projects, workItems, suppliers] = await Promise.all([
    VIEWS[view].apply(supabase.from("purchases").select(PURCHASE_ROWS)).order("needed_by", { nullsFirst: false }),
    supabase.from("projects").select("id,name").order("name"),
    supabase.from("work_items").select("id,name,project_id").order("name"),
    supabase.from("people").select("id,name").in("role", ["supplier", "contractor"]).eq("active", true).order("name"),
  ]);

  const db = await withCustomFields(supabase, "purchases", purchaseColumns(me.role, suppliers.data ?? [], workItems.data ?? [], true),
    ((rows.data ?? []) as Record<string, unknown>[]).map(purchaseRow) as Row[]);

  return (
    <>
      <PageTitle title="Procurement" sub="Material requests, quotes, purchase orders and deliveries" />
      <ErrorNote error={sp.error} />
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(VIEWS).map(([k, v]) => (
          <Link key={k} href={`/procurement?view=${k}`} className={`btn btn-sm ${k === view ? "btn-primary" : ""}`}><T>{v.label}</T></Link>
        ))}
      </div>
      <Card>
        <Database id={`procurement:${view}`} table="purchases" rows={db.rows} columns={db.columns} titleKey="request" editable creatable={false}
          fieldsTable="purchases" canManageFields={me.role === "management"} initial={{ group: "project_name" }} views={["table", "board", "calendar"]} />
      </Card>
      {(
        <Card title="Request materials">
          <PurchaseRequestForm projects={projects.data ?? []} workItems={workItems.data ?? []} suppliers={suppliers.data ?? []} back={back} />
        </Card>
      )}
    </>
  );
}
