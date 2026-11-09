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
  people: ["name","company","role","active","vendor_category","contact_person","phone","email","payment_terms","rating","notes"],
  contracts: ["number","title","status","start_date","finish_date","retention_pct","link","notes"],
};
const CREATE_EXTRA: Record<string, string[]> = {
  work_items: ["project_id"], site_tasks: ["project_id"], purchases: ["project_id"], submittals: ["project_id"],
  people: ["role"], contracts: ["project_id","vendor_id"],
};

type Value = string | number | boolean | null;

export async function updateField(table: string, id: string, field: string, value: Value): Promise<{ error?: string }> {
  const supabase = await createClient();
  const res = field.startsWith("cf:") ? { error: (await setCustom(supabase, id, field, value))?.message } : await updateFieldInner(supabase, table, id, field, value);
  revalidatePath("/", "layout");
  return res.error ? { error: res.error } : {};
}

async function updateFieldInner(supabase: Awaited<ReturnType<typeof createClient>>, table: string, id: string, field: string, value: Value): Promise<{ error?: string }> {
  if (table === "work_items" && field === "cost_rate") {
    const { error } = await supabase.from("work_item_costs").upsert({ work_item_id: id, cost_rate: value === "" ? null : value, updated_at: new Date().toISOString() });
    return error ? { error: error.message } : {};
  }
  if (!EDITABLE[table]?.includes(field)) return { error: "This field can't be edited here." };
  const { error } = await supabase.from(table).update({ [field]: value === "" ? null : value }).eq("id", id);
  return error ? { error: error.message } : {};
}

export async function createRow(table: string, values: Record<string, Value>): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const res = await createRowInner(supabase, table, values);
  revalidatePath("/", "layout");
  return res;
}

async function createRowInner(supabase: Awaited<ReturnType<typeof createClient>>, table: string, values: Record<string, Value>): Promise<{ error?: string; id?: string }> {
  const allowedKeys = [...(EDITABLE[table] ?? []), ...(CREATE_EXTRA[table] ?? [])];
  if (!allowedKeys.length) return { error: "Can't add rows here." };
  const row = Object.fromEntries(Object.entries(values).filter(([k, v]) => allowedKeys.includes(k) && v !== "" && v !== null));
  const { data, error } = await supabase.from(table).insert(row).select("id").single();
  if (error) return { error: error.message };
  const id = data.id as string;
  if (table === "work_items" && values.cost_rate !== undefined && values.cost_rate !== null && values.cost_rate !== "") {
    const r = await updateFieldInner(supabase, table, id, "cost_rate", values.cost_rate);
    if (r.error) return { error: r.error, id };
  }
  for (const [k, v] of Object.entries(values)) {
    if (!k.startsWith("cf:") || v === null || v === "") continue;
    const e = await setCustom(supabase, id, k, v);
    if (e) return { error: e.message, id };
  }
  return { id };
}

export async function deleteRow(table: string, id: string): Promise<{ error?: string }> {
  if (!["work_items", "site_tasks", "purchases", "submittals"].includes(table)) return { error: "Can't delete here." };
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  revalidatePath("/", "layout");
  return error ? { error: error.message } : {};
}

// ---------- Custom columns (management) ----------
const CUSTOM_TABLES = ["work_items", "site_tasks", "purchases", "submittals"];
const FIELD_TYPES = ["text", "longtext", "number", "money", "date", "select", "checkbox", "url"];

export async function saveCustomField(f: { id?: string; table_name: string; label: string; type: string; options: string[]; client_visible: boolean }): Promise<{ error?: string }> {
  if (!CUSTOM_TABLES.includes(f.table_name) || !FIELD_TYPES.includes(f.type) || !f.label.trim()) return { error: "Give the column a name and type." };
  const supabase = await createClient();
  const row = { table_name: f.table_name, label: f.label.trim(), type: f.type, options: f.options.map((o) => o.trim()).filter(Boolean), client_visible: f.client_visible };
  let error;
  if (f.id) ({ error } = await supabase.from("custom_fields").update(row).eq("id", f.id));
  else {
    const { data: last } = await supabase.from("custom_fields").select("position").eq("table_name", f.table_name).order("position", { ascending: false }).limit(1).maybeSingle();
    ({ error } = await supabase.from("custom_fields").insert({ ...row, position: (last?.position ?? 0) + 1 }));
  }
  revalidatePath("/", "layout");
  return error ? { error: error.message } : {};
}

export async function deleteCustomField(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("custom_fields").delete().eq("id", id);
  revalidatePath("/", "layout");
  return error ? { error: error.message } : {};
}

export async function moveCustomField(id: string, dir: -1 | 1): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: f } = await supabase.from("custom_fields").select("table_name").eq("id", id).single();
  if (!f) return { error: "Column not found." };
  const { data: all } = await supabase.from("custom_fields").select("id,position").eq("table_name", f.table_name).order("position").order("created_at");
  const list = all ?? [];
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return {};
  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, x] of list.entries()) {
    const { error } = await supabase.from("custom_fields").update({ position: k }).eq("id", x.id);
    if (error) return { error: error.message };
  }
  revalidatePath("/", "layout");
  return {};
}

async function setCustom(supabase: Awaited<ReturnType<typeof createClient>>, rowId: string, key: string, value: Value) {
  const fieldId = key.slice(3);
  const v = value === null || value === "" ? null : String(value);
  const { error } = v === null
    ? await supabase.from("custom_values").delete().eq("field_id", fieldId).eq("row_id", rowId)
    : await supabase.from("custom_values").upsert({ field_id: fieldId, row_id: rowId, value: v });
  return error;
}

/** Many cell changes at once (paste from a spreadsheet). New rows are created first. */
export async function bulkUpdate(table: string, changes: { id: string; field: string; value: Value }[],
  newRows: Record<string, Value>[] = []): Promise<{ error?: string; done: number }> {
  const supabase = await createClient();
  let done = 0;
  for (const c of changes) {
    const res = c.field.startsWith("cf:") ? { error: (await setCustom(supabase, c.id, c.field, c.value))?.message } : await updateFieldInner(supabase, table, c.id, c.field, c.value);
    if (res.error) { revalidatePath("/", "layout"); return { error: res.error, done }; }
    done++;
  }
  for (const r of newRows) {
    const res = await createRowInner(supabase, table, r);
    if (res.error) { revalidatePath("/", "layout"); return { error: res.error, done }; }
    done++;
  }
  revalidatePath("/", "layout");
  return { done };
}
