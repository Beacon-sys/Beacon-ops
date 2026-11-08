import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMe, allowed, money, date, LABELS } from "@/lib/data";
import { PageTitle, Card, Table, Field, Badge } from "@/components/ui";
import { saveVendor } from "@/app/actions";
import { ErrorNote } from "@/components/error-note";

type Vendor = {
  id: string; name: string; role: string; company: string | null; vendor_category: string | null; trades: string[] | null;
  contact_person: string | null; phone: string | null; email: string | null; tax_id: string | null; commercial_reg: string | null;
  address: string | null; payment_terms: string | null; rating: number | null; notes: string | null; active: boolean;
};
type Summary = { id: string; orders: number; ordered_value: number; paid_value: number; last_order: string | null };

export default async function Vendors({ searchParams }: {
  searchParams: Promise<{ type?: string; trade?: string; q?: string; error?: string }>;
}) {
  const { supabase, me } = await requireMe();
  if (!allowed(me.role, ["procurement", "site_ops", "accountant", "tendering"])) redirect("/");
  const sp = await searchParams;
  const canEdit = me.role === "management" || me.role === "procurement";

  let q = supabase.from("people").select("*").in("role", sp.type === "supplier" || sp.type === "contractor" ? [sp.type] : ["supplier", "contractor"]);
  if (sp.trade) q = q.contains("trades", [sp.trade]);
  if (sp.q) q = q.or(`name.ilike.%${sp.q.replace(/[%,()]/g, "")}%,vendor_category.ilike.%${sp.q.replace(/[%,()]/g, "")}%`);
  const [{ data }, { data: sums }] = await Promise.all([
    q.order("active", { ascending: false }).order("name"),
    supabase.from("vendor_summary").select("*"),
  ]);
  const vendors = (data ?? []) as Vendor[];
  const sum = new Map(((sums ?? []) as Summary[]).map((s) => [s.id, s]));
  const link = (k: string, v?: string) => {
    const p = new URLSearchParams({ ...(sp.type ? { type: sp.type } : {}), ...(sp.trade ? { trade: sp.trade } : {}), ...(sp.q ? { q: sp.q } : {}) });
    if (v) p.set(k, v); else p.delete(k);
    const s = p.toString();
    return `/procurement/vendors${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageTitle title="Vendors & contractors" sub="Suppliers of materials and subcontractors, with their details and order history" />
      <ErrorNote error={sp.error} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[["", "All"], ["supplier", "Suppliers"], ["contractor", "Contractors"]].map(([k, l]) => (
          <Link key={k} href={link("type", k || undefined)} className={`btn btn-sm ${(sp.type ?? "") === k ? "btn-primary" : ""}`}>{l}</Link>
        ))}
        <form className="ml-auto flex gap-2" action="/procurement/vendors">
          {sp.type && <input type="hidden" name="type" value={sp.type} />}
          <select name="trade" defaultValue={sp.trade ?? ""} className="input w-44">
            <option value="">Any trade</option>
            {Object.entries(LABELS.trade).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name or category" className="input w-52" />
          <button className="btn btn-sm">Filter</button>
        </form>
      </div>

      <Card>
        <Table head={["Name", "Type", "Category / trades", "Contact", "Terms", "Rating", "Orders", "Ordered", "Last order", ""]} empty={!vendors.length}>
          {vendors.map((v) => {
            const s = sum.get(v.id);
            return (
              <tr key={v.id} className={v.active ? "" : "opacity-50"}>
                <td><Link className="link font-medium" href={`/procurement/vendors/${v.id}`}>{v.name}</Link>{v.company && v.company !== v.name && <div className="text-xs text-muted">{v.company}</div>}</td>
                <td><span className={`badge ${v.role === "contractor" ? "badge-info" : "badge-neutral"}`}>{LABELS.role[v.role as "supplier"]}</span></td>
                <td>
                  <div>{v.vendor_category}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{(v.trades ?? []).map((t) => <Badge key={t} set="trade" value={t} />)}</div>
                </td>
                <td className="text-xs">
                  <div className="text-sm">{v.contact_person}</div>
                  {v.phone && <div><a className="link" href={`tel:${v.phone}`}>{v.phone}</a></div>}
                  {v.email && <div><a className="link" href={`mailto:${v.email}`}>{v.email}</a></div>}
                </td>
                <td>{v.payment_terms}</td>
                <td className="whitespace-nowrap text-[var(--warn)]" aria-label={v.rating ? `${v.rating} out of 5` : "Not rated"}>
                  {v.rating ? "★".repeat(v.rating) + "☆".repeat(5 - v.rating) : <span className="text-muted">—</span>}
                </td>
                <td className="tabular-nums">{s?.orders ?? 0}</td>
                <td className="tabular-nums">{money(s?.ordered_value ?? 0)}</td>
                <td>{date(s?.last_order)}</td>
                <td className="text-right">
                  {canEdit && (
                    <details className="relative inline-block text-left">
                      <summary className="btn btn-sm list-none">Edit</summary>
                      <div className="absolute right-0 z-10 mt-1 w-[min(90vw,560px)] rounded-xl border border-line bg-surface p-4 shadow-lg">
                        <VendorForm vendor={v} />
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {canEdit && <Card title="Add a vendor or contractor" id="add"><VendorForm /></Card>}
    </>
  );
}

function VendorForm({ vendor }: { vendor?: Vendor }) {
  const v = (k: keyof Vendor) => (vendor?.[k] ?? "") as string;
  return (
    <form action={saveVendor} className="grid gap-3 sm:grid-cols-2">
      {vendor && <input type="hidden" name="id" value={vendor.id} />}
      <Field label="Name"><input name="name" required defaultValue={v("name")} className="input" /></Field>
      <Field label="Type">
        <select name="role" defaultValue={v("role") || "supplier"} className="input">
          <option value="supplier">Supplier (materials)</option>
          <option value="contractor">Contractor (works)</option>
        </select>
      </Field>
      <Field label="Category"><input name="vendor_category" placeholder="e.g. Steel, Ready-mix, Electrical works" defaultValue={v("vendor_category")} className="input" /></Field>
      <Field label="Company / legal name"><input name="company" defaultValue={v("company")} className="input" /></Field>
      <div className="sm:col-span-2">
        <span className="text-sm text-muted">Trades</span>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(LABELS.trade).map(([k, l]) => (
            <label key={k} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="trades" value={k} defaultChecked={vendor?.trades?.includes(k)} />{l}
            </label>
          ))}
        </div>
      </div>
      <Field label="Contact person"><input name="contact_person" defaultValue={v("contact_person")} className="input" /></Field>
      <Field label="Phone"><input name="phone" type="tel" defaultValue={v("phone")} className="input" /></Field>
      <Field label="Email"><input name="email" type="email" defaultValue={v("email")} className="input" /></Field>
      <Field label="Payment terms"><input name="payment_terms" placeholder="e.g. 30 days, cash on delivery" defaultValue={v("payment_terms")} className="input" /></Field>
      <Field label="Tax registration no."><input name="tax_id" defaultValue={v("tax_id")} className="input" /></Field>
      <Field label="Commercial register no."><input name="commercial_reg" defaultValue={v("commercial_reg")} className="input" /></Field>
      <div className="sm:col-span-2"><Field label="Address"><input name="address" defaultValue={v("address")} className="input" /></Field></div>
      <Field label="Rating">
        <select name="rating" defaultValue={vendor?.rating ?? ""} className="input">
          <option value="">Not rated</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}
        </select>
      </Field>
      {vendor && (
        <Field label="Status">
          <select name="active" defaultValue={vendor.active ? "on" : "off"} className="input">
            <option value="on">Active</option><option value="off">Not in use</option>
          </select>
        </Field>
      )}
      <div className="sm:col-span-2"><Field label="Notes"><textarea name="notes" rows={2} defaultValue={v("notes")} className="input" /></Field></div>
      <div className="sm:col-span-2"><button className="btn btn-primary">{vendor ? "Save" : "Add vendor"}</button></div>
    </form>
  );
}
