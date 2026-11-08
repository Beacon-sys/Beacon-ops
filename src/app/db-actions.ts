"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fields each database lets people edit inline. Row-level security still decides who may.
const EDITABLE: Record<string, string[]> = {
  work_items: ["name","boq_ref","item_type","category","trade","area","quantity","unit","beacon_rate","status","progress",
    "planned_start","planned_finish","actual_start","actual_finish","visible_to_client","notes"],
  site_tasks: ["task","type","assigned_to_id","planned_start","due","priority","status","notes","work_item_id"],
  purchases: ["request","needed_by","quantity","unit","supplier_id","po_number","amount","status","payment_status","invoice_no","notes","work_item_id"],
  submittals: ["number","title","kind","revision","status","submitted_on","due_back","returned_on","link","notes"],
  people: ["name","company","vendor_category","contact_person","phone","email","payment_terms","rating","notes"],
  contracts: ["number","title","status","start_date","finish_date","retention_pct","link","notes"],
};
const CREATE_EXTRA: Record<string, string[]> = {
  work_items: ["project_id"], site_tasks: ["project_id"], purchases: ["project_id"], submittals: ["project_id"],
  people: ["role"], contracts: ["project_id","vendor_id"],
};

type Value = string | number | boolean | null;

export async function updateField(table: string, id: string, field: string, value: Value): Promise<{ error?: string }> {
  const supabase = await createClient();
  if (table === "work_items" && field === "cost_rate") {
    const { error } = await supabase.from("work_item_costs").upsert({ work_item_id: id, cost_rate: value === "" ? null : value, updated_at: new Date().toISOString() });
    revalidatePath("/", "layout");
    return error ? { error: error.message } : {};
  }
  if (!EDITABLE[table]?.includes(field)) return { error: "This field can't be edited here." };
  const { error } = await supabase.from(table).update({ [field]: value === "" ? null : value }).eq("id", id);
  revalidatePath("/", "layout");
  return error ? { error: error.message } : {};
}

export async function createRow(table: string, values: Record<string, Value>): Promise<{ error?: string; id?: string }> {
  const allowedKeys = [...(EDITABLE[table] ?? []), ...(CREATE_EXTRA[table] ?? [])];
  if (!allowedKeys.length) return { error: "Can't add rows here." };
  const row = Object.fromEntries(Object.entries(values).filter(([k, v]) => allowedKeys.includes(k) && v !== "" && v !== null));
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).insert(row).select("id").single();
  revalidatePath("/", "layout");
  return error ? { error: error.message } : { id: data.id as string };
}

export async function deleteRow(table: string, id: string): Promise<{ error?: string }> {
  if (!["work_items", "site_tasks", "purchases", "submittals"].includes(table)) return { error: "Can't delete here." };
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  revalidatePath("/", "layout");
  return error ? { error: error.message } : {};
}
