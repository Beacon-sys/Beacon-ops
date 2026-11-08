import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMe, isInternal, LABELS } from "@/lib/data";
import { PageTitle, Card } from "@/components/ui";
import { PurchaseTable, PURCHASE_SELECT, type PurchaseRow } from "@/components/purchase-table";
import { PurchaseRequestForm } from "@/components/forms";
import { ErrorNote } from "@/components/error-note";

const VIEWS: Record<string, { label: string; apply: (q: any) => any }> = { // eslint-disable-line @typescript-eslint/no-explicit-any
  open: { label: "Open", apply: (q) => q.not("status", "in", "(delivered,rejected)") },
  approval: { label: "Needs approval", apply: (q) => q.in("status", ["requested", "getting_quotes"]) },
  to_pay: { label: "To pay", apply: (q) => q.neq("status", "rejected").neq("payment_status", "paid").in("status", ["po_issued", "delivered"]) },
  all: { label: "All", apply: (q) => q },
};

export default async function Purchasing({ searchParams }: { searchParams: Promise<{ view?: string; error?: string }> }) {
  const { supabase, me } = await requireMe();
  if (!isInternal(me.role)) redirect("/");
  const sp = await searchParams;
  const view = sp.view && VIEWS[sp.view] ? sp.view : me.role === "accountant" ? "to_pay" : "open";
  const back = `/purchasing?view=${view}`;

  const [rows, projects, workItems, suppliers] = await Promise.all([
    VIEWS[view].apply(supabase.from("purchases").select(PURCHASE_SELECT)).order("needed_by", { nullsFirst: false }),
    supabase.from("projects").select("id,name").order("name"),
    supabase.from("work_items").select("id,name,project_id").order("name"),
    supabase.from("people").select("id,name").eq("role", "supplier").eq("active", true).order("name"),
  ]);

  return (
    <>
      <PageTitle title="Purchasing" sub={`Signed in as ${LABELS.role[me.role]}`} />
      <ErrorNote error={sp.error} />
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(VIEWS).map(([k, v]) => (
          <Link key={k} href={`/purchasing?view=${k}`} className={`btn btn-sm ${k === view ? "btn-primary" : ""}`}>{v.label}</Link>
        ))}
      </div>
      <Card>
        <PurchaseTable rows={(rows.data ?? []) as unknown as PurchaseRow[]} role={me.role} suppliers={suppliers.data ?? []} back={back} />
      </Card>
      {me.role !== "accountant" && (
        <Card title="Request materials">
          <PurchaseRequestForm projects={projects.data ?? []} workItems={workItems.data ?? []} suppliers={suppliers.data ?? []} back={back} />
        </Card>
      )}
    </>
  );
}
