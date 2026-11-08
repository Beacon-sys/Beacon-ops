import { updatePurchase } from "@/app/actions";
import { money, date, type Role } from "@/lib/data";
import { Table, Badge, Select, PersonSelect, Field } from "@/components/ui";

export type PurchaseRow = {
  id: string; request: string; status: string; payment_status: string; amount: number | null;
  needed_by: string | null; quantity: number | null; unit: string | null;
  po_number: string | null; invoice_no: string | null; supplier_id: string | null;
  project?: { name: string } | null; supplier?: { name: string } | null; work_item?: { name: string } | null;
};

const NEXT: Record<string, { to: string; label: string }[]> = {
  requested: [{ to: "getting_quotes", label: "Getting quotes" }, { to: "approved", label: "Approve" }, { to: "rejected", label: "Reject" }],
  getting_quotes: [{ to: "approved", label: "Approve" }, { to: "rejected", label: "Reject" }],
  approved: [{ to: "po_issued", label: "PO issued" }],
  po_issued: [{ to: "delivered", label: "Delivered" }],
};

export function PurchaseTable({ rows, role, suppliers, back, showProject = true }: {
  rows: PurchaseRow[]; role: Role; suppliers: { id: string; name: string }[]; back: string; showProject?: boolean;
}) {
  const canProcure = role === "management" || role === "procurement";
  const canPay = role === "management" || role === "accountant";
  const showMoney = role !== "site_ops";
  return (
    <Table
      head={["Request", ...(showProject ? ["Project"] : []), "Needed by", "Supplier", ...(showMoney ? ["Amount"] : []), "Status", "Payment", ""]}
      empty={!rows.length}
    >
      {rows.map((x) => {
        const days = x.needed_by ? (new Date(x.needed_by).getTime() - Date.now()) / 86400000 : null;
        const late = days !== null && days < 3 && !["delivered", "rejected"].includes(x.status);
        return (
          <tr key={x.id}>
            <td>
              <div>{x.request}</div>
              <div className="text-xs text-muted">
                {[x.quantity && `${x.quantity} ${x.unit ?? ""}`, x.work_item?.name, x.po_number && `PO ${x.po_number}`].filter(Boolean).join(" · ")}
              </div>
            </td>
            {showProject && <td className="text-muted">{x.project?.name}</td>}
            <td className={late ? "text-[var(--bad)]" : ""}>{date(x.needed_by)}</td>
            <td>{x.supplier?.name}</td>
            {showMoney && <td className="tabular-nums">{money(x.amount)}</td>}
            <td><Badge set="purchase_status" value={x.status} /></td>
            <td><Badge set="payment_status" value={x.payment_status} /></td>
            <td className="text-right">
              {(canProcure || canPay) && (
                <details className="relative inline-block text-left">
                  <summary className="btn btn-sm list-none">Update</summary>
                  <div className="absolute right-0 z-10 mt-1 w-72 rounded-xl border border-line bg-surface p-3 shadow-lg">
                    {canProcure && (
                      <>
                        <div className="mb-2 flex flex-wrap gap-1">
                          {(NEXT[x.status] ?? []).map((n) => (
                            <form key={n.to} action={updatePurchase}>
                              <input type="hidden" name="id" value={x.id} />
                              <input type="hidden" name="back" value={back} />
                              <input type="hidden" name="status" value={n.to} />
                              <button className="btn btn-sm">{n.label}</button>
                            </form>
                          ))}
                        </div>
                        <form action={updatePurchase} className="mb-3 grid gap-2 border-b border-line pb-3">
                          <input type="hidden" name="id" value={x.id} />
                          <input type="hidden" name="back" value={back} />
                          <Field label="Supplier"><PersonSelect name="supplier_id" people={suppliers} defaultValue={x.supplier_id} /></Field>
                          <Field label="PO number"><input name="po_number" defaultValue={x.po_number ?? ""} className="input" /></Field>
                          <Field label="Amount (EGP)"><input name="amount" type="number" step="0.01" defaultValue={x.amount ?? ""} className="input" /></Field>
                          <button className="btn btn-sm btn-primary justify-center">Save order details</button>
                        </form>
                      </>
                    )}
                    {canPay && (
                      <form action={updatePurchase} className="grid gap-2">
                        <input type="hidden" name="id" value={x.id} />
                        <input type="hidden" name="back" value={back} />
                        <Field label="Payment"><Select name="payment_status" set="payment_status" defaultValue={x.payment_status} /></Field>
                        <Field label="Invoice no."><input name="invoice_no" defaultValue={x.invoice_no ?? ""} className="input" /></Field>
                        <button className="btn btn-sm btn-primary justify-center">Save payment</button>
                      </form>
                    )}
                  </div>
                </details>
              )}
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

export const PURCHASE_SELECT =
  "id,request,status,payment_status,amount,needed_by,quantity,unit,po_number,invoice_no,supplier_id," +
  "project:projects(name),supplier:people!purchases_supplier_id_fkey(name),work_item:work_items(name)";
