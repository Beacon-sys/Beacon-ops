import { notFound, redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { T } from "@/components/i18n";
import Link from "next/link";
import { requireMe, allowed, money, date, label } from "@/lib/data";
import { PageTitle, Card, Table, Badge, Progress, Stat } from "@/components/ui";
import { PurchaseTable, PURCHASE_SELECT, type PurchaseRow } from "@/components/purchase-table";

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, me } = await requireMe();
  if (!allowed(me.role, ["procurement", "site_ops", "accountant", "tendering"])) redirect("/");

  const { data: v } = await supabase.from("people").select("*").eq("id", id).in("role", ["supplier", "contractor"]).maybeSingle();
  if (!v) notFound();
  const [{ data: contracts }, { data: purchases }] = await Promise.all([
    supabase.from("contract_summary").select("*, project:projects(id,name)").eq("vendor_id", id).order("start_date", { nullsFirst: false }),
    supabase.from("purchases").select(PURCHASE_SELECT).eq("supplier_id", id).order("created_at", { ascending: false }),
  ]);
  type C = { id: string; number: string | null; title: string; status: string; start_date: string | null; finish_date: string | null;
    contract_value: number; item_count: number; progress: number | null; project: { id: string; name: string } | null };
  const cs = (contracts ?? []) as unknown as C[];
  const { data: items } = cs.length
    ? await supabase.from("contract_items")
        .select("contract_id, rate, quantity, start_date, finish_date, work_item:work_items(id,boq_ref,name,quantity,unit,status,progress,planned_finish,actual_start,actual_finish,project:projects(name))")
        .in("contract_id", cs.map((c) => c.id))
    : { data: [] };
  type I = { contract_id: string; rate: number | null; quantity: number | null; start_date: string | null; finish_date: string | null;
    work_item: { id: string; boq_ref: string | null; name: string; quantity: number | null; unit: string | null; status: string; progress: number;
      planned_finish: string | null; actual_start: string | null; actual_finish: string | null; project: { name: string } | null } };
  const rows = ((items ?? []) as unknown as I[]).sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
  const today = new Date().toISOString().slice(0, 10);
  const lateCount = rows.filter((r) => r.work_item.status !== "done" && (r.finish_date ?? r.work_item.planned_finish ?? "9999") < today).length;
  const total = cs.reduce((s, c) => s + Number(c.contract_value ?? 0), 0);

  return (
    <>
      <div className="mb-2 text-sm"><Link className="link" href="/procurement/vendors"><T>{"← Vendors & contractors"}</T></Link></div>
      <PageTitle title={v.name} sub={[(await getT())(label("role", v.role)), v.vendor_category, v.contact_person, v.phone, v.email].filter(Boolean).join(" · ")} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Contracts" value={cs.length} />
        <Stat label="Contracted value" value={money(total) || "—"} />
        <Stat label="Work items" value={rows.length} />
        <Stat label="Items running late" value={<span className={lateCount ? "text-[var(--bad)]" : ""}>{lateCount}</span>} />
      </div>

      <Card title="Work items and dates">
        <Table head={["Project", "BOQ", "Work item", "Rate", "Contract start", "Contract finish", "Actual start", "Actual finish", "Status"]} empty={!rows.length}>
          {rows.map((r) => {
            const w = r.work_item;
            const due = r.finish_date ?? w.planned_finish;
            const late = w.status !== "done" && due && due < today;
            return (
              <tr key={r.contract_id + w.id}>
                <td className="text-muted">{w.project?.name}</td>
                <td className="whitespace-nowrap">{w.boq_ref}</td>
                <td className="min-w-[220px]"><Link className="link" href={`/work-items/${w.id}`}>{w.name}</Link></td>
                <td className="tabular-nums">{r.rate ?? ""}</td>
                <td>{date(r.start_date)}</td>
                <td className={late ? "font-medium text-[var(--bad)]" : ""}>{date(due)}</td>
                <td>{date(w.actual_start)}</td>
                <td>{date(w.actual_finish)}</td>
                <td><Badge set="work_item_status" value={w.status} /><div className="mt-1"><Progress v={w.progress} /></div></td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card title="Contracts">
        <Table head={["Contract", "Project", "Value", "Start", "Finish", "Progress", "Status"]} empty={!cs.length}>
          {cs.map((c) => (
            <tr key={c.id}>
              <td><Link className="link" href={`/procurement/contracts/${c.id}`}>{c.number ? `${c.number} · ` : ""}{c.title}</Link></td>
              <td className="text-muted">{c.project?.name}</td>
              <td className="tabular-nums">{money(c.contract_value)}</td>
              <td>{date(c.start_date)}</td>
              <td>{date(c.finish_date)}</td>
              <td><Progress v={c.progress} /></td>
              <td><Badge set="contract_status" value={c.status} /></td>
            </tr>
          ))}
        </Table>
        {(me.role === "management" || me.role === "procurement") && (
          <Link className="btn btn-sm mt-3" href="/procurement/contracts#new"><T>{"+ New contract"}</T></Link>
        )}
      </Card>

      <Card title="Purchase orders">
        <PurchaseTable rows={(purchases ?? []) as unknown as PurchaseRow[]} role={me.role} suppliers={[{ id: v.id, name: v.name }]} back={`/procurement/vendors/${id}`} />
      </Card>
    </>
  );
}
