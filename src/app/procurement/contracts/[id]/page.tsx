import { notFound, redirect } from "next/navigation";
import { T } from "@/components/i18n";
import Link from "next/link";
import { requireMe, allowed, money, date } from "@/lib/data";
import { PageTitle, Card, Table, Badge, Progress, Stat } from "@/components/ui";
import { ContractForm } from "@/components/contract-form";
import { ErrorNote } from "@/components/error-note";
import { saveContractItems, removeContractItem } from "@/app/actions";

const num = (n: number | null) => (n === null || n === undefined ? "" : Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 }));

export default async function ContractPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, me } = await requireMe();
  if (!allowed(me.role, ["procurement", "accountant", "site_ops", "tendering"])) redirect("/");
  const canEdit = me.role === "management" || me.role === "procurement";

  const { data: c } = await supabase.from("contract_summary").select("*, project:projects(id,name), vendor:people(id,name,phone,email)").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: items }, { data: projectItems }, { data: projects }, { data: vendors }] = await Promise.all([
    supabase.from("contract_items").select("*, work_item:work_items(id,boq_ref,name,quantity,unit,status,progress,planned_start,planned_finish,actual_start,actual_finish)").eq("contract_id", id),
    supabase.from("work_items").select("id,boq_ref,name,quantity,unit,planned_start,planned_finish").eq("project_id", c.project_id).order("boq_ref", { nullsFirst: false }),
    supabase.from("projects").select("id,name").order("name"),
    supabase.from("people").select("id,name").in("role", ["contractor", "supplier"]).order("name"),
  ]);
  type WI = { id: string; boq_ref: string | null; name: string; quantity: number | null; unit: string | null; status: string; progress: number;
    planned_start: string | null; planned_finish: string | null; actual_start: string | null; actual_finish: string | null };
  type Item = { work_item_id: string; rate: number | null; quantity: number | null; start_date: string | null; finish_date: string | null; work_item: WI };
  const rows = (items ?? []) as unknown as Item[];
  const available = ((projectItems ?? []) as WI[]).filter((w) => !rows.some((r) => r.work_item_id === w.id));
  const vendor = c.vendor as { id: string; name: string; phone: string | null; email: string | null } | null;
  const project = c.project as { id: string; name: string } | null;

  return (
    <>
      <div className="mb-2 text-sm"><Link className="link" href="/procurement/contracts"><T>{"← Contracts"}</T></Link></div>
      <PageTitle title={`${c.number ? c.number + " · " : ""}${c.title}`}
        sub={[vendor?.name, project?.name].filter(Boolean).join(" · ")}
        action={<Badge set="contract_status" value={c.status} />} />
      <ErrorNote error={error} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Contract value" value={money(c.contract_value)} />
        <Stat label="Work items" value={c.item_count} />
        <Stat label="Dates" value={<span className="text-base">{date(c.start_date) || "—"} → {date(c.finish_date) || "—"}</span>} />
        <Stat label="Progress" value={<Progress v={c.progress} />} />
      </div>

      <Card title="Work items in this contract">
        {canEdit ? (
          <form action={saveContractItems}>
            <input type="hidden" name="contract_id" value={id} />
            <ItemsTable rows={rows} editable contractId={id} />
            {rows.length > 0 && <button className="btn btn-sm btn-primary mt-3"><T>{"Save rates and dates"}</T></button>}
          </form>
        ) : <ItemsTable rows={rows} contractId={id} />}
      </Card>

      {canEdit && available.length > 0 && (
        <Card title="Add work items to this contract">
          <form action={saveContractItems} className="flex flex-col gap-3">
            <input type="hidden" name="contract_id" value={id} />
            <div className="max-h-80 overflow-y-auto rounded-lg border border-line">
              {available.map((w) => (
                <label key={w.id} className="flex items-start gap-3 border-b border-line px-3 py-2 text-sm last:border-0">
                  <input type="checkbox" name="work_item_id" value={w.id} className="mt-1" />
                  <span className="flex-1"><span className="me-2 text-muted">{w.boq_ref}</span>{w.name}</span>
                  <span className="text-xs text-muted">{num(w.quantity)} {w.unit}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted"><T>{"After adding, enter the contractor's rate and dates in the table above. Dates default to the work item's planned dates."}</T></p>
            <div><button className="btn btn-sm btn-primary"><T>{"Add selected"}</T></button></div>
          </form>
        </Card>
      )}

      {canEdit && (
        <Card title="Contract details">
          <ContractForm c={c} projects={projects ?? []} vendors={vendors ?? []} back={`/procurement/contracts/${id}`} />
        </Card>
      )}
    </>
  );
}

function ItemsTable({ rows, editable, contractId }: {
  rows: { work_item_id: string; rate: number | null; quantity: number | null; start_date: string | null; finish_date: string | null;
    work_item: { id: string; boq_ref: string | null; name: string; quantity: number | null; unit: string | null; status: string; progress: number;
      planned_start: string | null; planned_finish: string | null; actual_start: string | null; actual_finish: string | null } }[];
  editable?: boolean; contractId: string;
}) {
  const total = rows.reduce((s, r) => s + Number(r.rate ?? 0) * Number(r.quantity ?? r.work_item.quantity ?? 0), 0);
  return (
    <Table head={["BOQ", "Work item", "Qty", "Rate", "Amount", "Contract start", "Contract finish", "Actual", "Status", ...(editable ? [""] : [])]} empty={!rows.length}>
      {rows.map((r) => {
        const w = r.work_item;
        const qty = r.quantity ?? w.quantity;
        return (
          <tr key={r.work_item_id}>
            <td className="whitespace-nowrap">{w.boq_ref}</td>
            <td className="min-w-[220px]"><Link className="link" href={`/work-items/${w.id}`}>{w.name}</Link></td>
            {editable ? (
              <>
                <td><input type="hidden" name="work_item_id" value={r.work_item_id} />
                  <input name={`quantity_${r.work_item_id}`} type="number" step="0.01" defaultValue={r.quantity ?? ""} placeholder={String(w.quantity ?? "")} className="input w-24" /></td>
                <td><input name={`rate_${r.work_item_id}`} type="number" step="0.01" defaultValue={r.rate ?? ""} className="input w-28" /></td>
                <td className="tabular-nums">{money(Number(r.rate ?? 0) * Number(qty ?? 0))}</td>
                <td><input name={`start_date_${r.work_item_id}`} type="date" defaultValue={r.start_date ?? w.planned_start ?? ""} className="input" /></td>
                <td><input name={`finish_date_${r.work_item_id}`} type="date" defaultValue={r.finish_date ?? w.planned_finish ?? ""} className="input" /></td>
              </>
            ) : (
              <>
                <td className="tabular-nums">{num(qty)} {w.unit}</td>
                <td className="tabular-nums">{num(r.rate)}</td>
                <td className="tabular-nums">{money(Number(r.rate ?? 0) * Number(qty ?? 0))}</td>
                <td>{date(r.start_date ?? w.planned_start)}</td>
                <td>{date(r.finish_date ?? w.planned_finish)}</td>
              </>
            )}
            <td className="whitespace-nowrap text-xs">{date(w.actual_start) || "—"}<br />{date(w.actual_finish) || ""}</td>
            <td><Badge set="work_item_status" value={w.status} /><div className="mt-1"><Progress v={w.progress} /></div></td>
            {editable && (
              <td>
                <button formAction={removeContractItem} name="remove_id" value={r.work_item_id} className="btn btn-sm"
                  formNoValidate><T>{"Remove"}</T></button>
                <input type="hidden" name="contract_id" value={contractId} />
              </td>
            )}
          </tr>
        );
      })}
      {rows.length > 0 && (
        <tr className="font-semibold"><td colSpan={4}><T>{"Total"}</T></td><td className="tabular-nums">{money(total)}</td><td colSpan={editable ? 5 : 4} /></tr>
      )}
    </Table>
  );
}
