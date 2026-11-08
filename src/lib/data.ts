import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role =
  | "management" | "site_ops" | "procurement" | "accountant"
  | "client" | "consultant" | "supplier";

export type Me = { id: string; name: string; email: string | null; role: Role };

export const INTERNAL: Role[] = ["management", "site_ops", "procurement", "accountant"];

export async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("people").select("id,name,email,role").eq("user_id", user.id).maybeSingle();
  return { supabase, user, me: me as Me | null };
}

export async function requireMe() {
  const ctx = await getMe();
  if (!ctx.me) redirect("/no-access");
  return ctx as typeof ctx & { me: Me };
}

export const isInternal = (r: Role) => INTERNAL.includes(r);

export const LABELS = {
  role: {
    management: "Management", site_ops: "Site operations", procurement: "Procurement",
    accountant: "Accountant", client: "Client", consultant: "Consultant", supplier: "Supplier",
  },
  project_status: {
    tendering: "Tendering", active: "Active", on_hold: "On hold",
    handed_over: "Handed over", closed: "Closed",
  },
  trade: {
    civil: "Civil", structural: "Structural", architectural_finishes: "Architectural / Finishes",
    mep_mechanical: "MEP - Mechanical", mep_electrical: "MEP - Electrical",
    mep_plumbing: "MEP - Plumbing", landscape: "Landscape", general: "General",
  },
  work_item_status: {
    not_started: "Not started", in_progress: "In progress", awaiting_materials: "Awaiting materials",
    awaiting_approval: "Awaiting approval", done: "Done", on_hold: "On hold",
  },
  purchase_status: {
    requested: "Requested", getting_quotes: "Getting quotes", approved: "Approved",
    po_issued: "PO issued", delivered: "Delivered", rejected: "Rejected",
  },
  payment_status: {
    not_invoiced: "Not invoiced", invoice_received: "Invoice received",
    partly_paid: "Partly paid", paid: "Paid",
  },
  site_task_type: {
    execution: "Execution", inspection: "Inspection", snag: "Snag / defect", safety: "Safety",
    survey: "Survey", handover: "Handover", other: "Other",
  },
  site_task_status: { to_do: "To do", in_progress: "In progress", blocked: "Blocked", done: "Done" },
  priority: { high: "High", medium: "Medium", low: "Low" },
} as const;

export type LabelSet = keyof typeof LABELS;

export function label(set: LabelSet, v: string | null | undefined) {
  if (!v) return "";
  return (LABELS[set] as Record<string, string>)[v] ?? v;
}

const egp = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });
export const money = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === "" ? "" : egp.format(Number(n));

export const pct = (n: number | string | null | undefined) =>
  n === null || n === undefined ? "" : `${Math.round(Number(n) * 100)}%`;

export const date = (d: string | null | undefined) =>
  d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

/** Turn FormData into a row: blanks become null. */
export function formRow(fd: FormData, keys: string[]) {
  const row: Record<string, string | number | boolean | null> = {};
  for (const k of keys) {
    const v = fd.get(k);
    row[k] = v === null || v === "" ? null : String(v);
  }
  return row;
}
