import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMe, allowed, money } from "@/lib/data";
import { PageTitle, Card, Table, Stat, Badge } from "@/components/ui";
import { Database, type Row } from "@/components/database";
import { purchaseColumns } from "@/lib/db-columns";
import { withCustomFields } from "@/lib/custom-fields";
import { PURCHASE_ROWS, purchaseRow } from "@/lib/project-db";
import { ErrorNote } from "@/components/error-note";

export default async function Accounting({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, me } = await requireMe();
  if (!allowed(me.role, ["accountant"])) redirect("/");
  const { error } = await searchParams;

  const [toPay, projects, suppliers] = await Promise.all([
    supabase.from("purchases").select(PURCHASE_ROWS)
      .in("status", ["po_issued", "delivered"]).neq("payment_status", "paid")
      .order("needed_by", { nullsFirst: false }),
    supabase.from("project_summary").select("id,name,code,status,contract_value,committed_spend,paid_to_date")
      .neq("status", "closed").order("name"),
    supabase.from("people").select("id,name").in("role", ["supplier", "contractor"]).order("name"),
  ]);
  const rows = ((toPay.data ?? []) as Record<string, unknown>[]).map(purchaseRow) as Row[];
  const db = await withCustomFields(supabase, "purchases", purchaseColumns(me.role, suppliers.data ?? [], [], true), rows);
  const owed = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const ps = projects.data ?? [];
  const sum = (k: "contract_value" | "committed_spend" | "paid_to_date") => ps.reduce((s, p) => s + Number(p[k] ?? 0), 0);

  return (
    <>
      <PageTitle title="Accounting" sub="Supplier payments and project finances" />
      <ErrorNote error={error} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Waiting for payment" value={rows.length} />
        <Stat label="Amount owed" value={money(owed) || "—"} />
        <Stat label="Committed (all projects)" value={money(sum("committed_spend"))} />
        <Stat label="Paid to date" value={money(sum("paid_to_date"))} />
      </div>
      <Card title="To pay">
        <Database id="accounting:to-pay" table="purchases" rows={db.rows} columns={db.columns} titleKey="request" editable creatable={false}
          fieldsTable="purchases" canManageFields={me.role === "management"} views={["table", "calendar"]} />
      </Card>
      <Card title="Project finances" id="finances">
        <Table head={["Project", "Status", "Contract", "Committed", "Paid", "Still to pay"]} empty={!ps.length}>
          {ps.map((p) => (
            <tr key={p.id}>
              <td><Link className="link" href={`/projects/${p.id}`}>{p.name}</Link></td>
              <td><Badge set="project_status" value={p.status} /></td>
              <td className="tabular-nums">{money(p.contract_value)}</td>
              <td className="tabular-nums">{money(p.committed_spend)}</td>
              <td className="tabular-nums">{money(p.paid_to_date)}</td>
              <td className="tabular-nums">{money(Number(p.committed_spend ?? 0) - Number(p.paid_to_date ?? 0))}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
