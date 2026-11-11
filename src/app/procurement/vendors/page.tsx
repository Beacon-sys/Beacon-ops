import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { T, TOption, TOptions } from "@/components/i18n";
import Link from "next/link";
import { requireMe, allowed, LABELS } from "@/lib/data";
import { Database, type Row as DbRow } from "@/components/database";
import { vendorColumns } from "@/lib/db-columns";
import { PageTitle, Card, Field } from "@/components/ui";
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
  const t = await getT();

  let q = supabase.from("people").select("*").in("role", sp.type === "supplier" || sp.type === "contractor" ? [sp.type] : ["supplier", "contractor"]);
  if (sp.trade) q = q.contains("trades", [sp.trade]);
  if (sp.q) q = q.or(`name.ilike.%${sp.q.replace(/[%,()]/g, "")}%,vendor_category.ilike.%${sp.q.replace(/[%,()]/g, "")}%`);
  const [{ data }, { data: sums }] = await Promise.all([
    q.order("active", { ascending: false }).order("name"),
    supabase.from("vendor_summary").select("*"),
  ]);
  const vendors = (data ?? []) as Vendor[];
  const sum = new Map(((sums ?? []) as Summary[]).map((s) => [s.id, s]));
  const dbRows = vendors.map((v) => {
    const x = sum.get(v.id);
    return { ...v, rating: v.rating ? String(v.rating) : null, trades_text: (v.trades ?? []).map((x) => t(LABELS.trade[x as keyof typeof LABELS.trade] ?? x)).join(", "),
      orders: x?.orders ?? 0, ordered_value: x?.ordered_value ?? 0, last_order: x?.last_order ?? null };
  }) as unknown as DbRow[];
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
          <Link key={k} href={link("type", k || undefined)} className={`btn btn-sm ${(sp.type ?? "") === k ? "btn-primary" : ""}`}><T>{l}</T></Link>
        ))}
        <form className="ms-auto flex gap-2" action="/procurement/vendors">
          {sp.type && <input type="hidden" name="type" value={sp.type} />}
          <select name="trade" defaultValue={sp.trade ?? ""} className="input w-44">
            <TOption value="" label="Any trade" />
            <TOptions options={Object.entries(LABELS.trade)} />
          </select>
          <input name="q" defaultValue={sp.q ?? ""} placeholder={t("Search name or category")} className="input w-52" />
          <button className="btn btn-sm"><T>{"Filter"}</T></button>
        </form>
      </div>

      <Card>
        <Database id="vendors" table="people" rows={dbRows} columns={vendorColumns()} titleKey="name" href="/procurement/vendors/:id"
          editable={canEdit} createDefaults={{ role: sp.type === "contractor" ? "contractor" : "supplier" }} views={["table", "board", "list"]}
          initial={{ boardBy: "role" }} />
        <p className="mt-2 text-xs text-muted"><T>{"Trades, tax and register numbers and the address are edited on each vendor's page."}</T></p>
      </Card>

      {canEdit && <Card title="Add a vendor or contractor" id="add"><VendorForm /></Card>}
    </>
  );
}

async function VendorForm({ vendor }: { vendor?: Vendor }) {
  const t = await getT();
  const v = (k: keyof Vendor) => (vendor?.[k] ?? "") as string;
  return (
    <form action={saveVendor} className="grid gap-3 sm:grid-cols-2">
      {vendor && <input type="hidden" name="id" value={vendor.id} />}
      <Field label="Name"><input name="name" required defaultValue={v("name")} className="input" /></Field>
      <Field label="Type">
        <select name="role" defaultValue={v("role") || "supplier"} className="input">
          <TOption value="supplier" label="Supplier (materials)" />
          <TOption value="contractor" label="Contractor (works)" />
        </select>
      </Field>
      <Field label="Category"><input name="vendor_category" placeholder={t("e.g. Steel, Ready-mix, Electrical works")} defaultValue={v("vendor_category")} className="input" /></Field>
      <Field label="Company / legal name"><input name="company" defaultValue={v("company")} className="input" /></Field>
      <div className="sm:col-span-2">
        <span className="text-sm text-muted"><T>{"Trades"}</T></span>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(LABELS.trade).map(([k, l]) => (
            <label key={k} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="trades" value={k} defaultChecked={vendor?.trades?.includes(k)} /><T>{l}</T>
            </label>
          ))}
        </div>
      </div>
      <Field label="Contact person"><input name="contact_person" defaultValue={v("contact_person")} className="input" /></Field>
      <Field label="Phone"><input name="phone" type="tel" defaultValue={v("phone")} className="input" /></Field>
      <Field label="Email"><input name="email" type="email" defaultValue={v("email")} className="input" /></Field>
      <Field label="Payment terms"><input name="payment_terms" placeholder={t("e.g. 30 days, cash on delivery")} defaultValue={v("payment_terms")} className="input" /></Field>
      <Field label="Tax registration no."><input name="tax_id" defaultValue={v("tax_id")} className="input" /></Field>
      <Field label="Commercial register no."><input name="commercial_reg" defaultValue={v("commercial_reg")} className="input" /></Field>
      <div className="sm:col-span-2"><Field label="Address"><input name="address" defaultValue={v("address")} className="input" /></Field></div>
      <Field label="Rating">
        <select name="rating" defaultValue={vendor?.rating ?? ""} className="input">
          <TOption value="" label="Not rated" />
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}
        </select>
      </Field>
      {vendor && (
        <Field label="Status">
          <select name="active" defaultValue={vendor.active ? "on" : "off"} className="input">
            <TOption value="on" label="Active" /><TOption value="off" label="Not in use" />
          </select>
        </Field>
      )}
      <div className="sm:col-span-2"><Field label="Notes"><textarea name="notes" rows={2} defaultValue={v("notes")} className="input" /></Field></div>
      <div className="sm:col-span-2"><button className="btn btn-primary"><T>{vendor ? "Save" : "Add vendor"}</T></button></div>
    </form>
  );
}
