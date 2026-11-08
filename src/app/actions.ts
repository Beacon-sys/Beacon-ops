"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formRow } from "@/lib/data";

const PROJECT = ["name","code","client_id","consultant_id","project_manager_id","location","status","start_date","planned_finish","contract_value"];
const WORK_ITEM = ["project_id","name","boq_ref","trade","area","status","responsible_id","planned_start","planned_finish","actual_start","actual_finish","quantity","unit","budget","notes"];
const PURCHASE = ["project_id","work_item_id","request","needed_by","quantity","unit","supplier_id","notes"];
const SITE_TASK = ["project_id","work_item_id","task","type","assigned_to_id","planned_start","due","priority","notes"];
const PERSON = ["name","email","phone","company","role"];

function fail(back: string, message: string): never {
  redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

async function save(table: string, row: Record<string, unknown>, id: string | null, back: string) {
  const supabase = await createClient();
  const q = id ? supabase.from(table).update(row).eq("id", id) : supabase.from(table).insert(row);
  const { error } = await q;
  if (error) fail(back, error.message);
}

export async function saveProject(fd: FormData) {
  const id = (fd.get("id") as string) || null;
  const back = id ? `/projects/${id}/edit` : "/projects/new";
  const supabase = await createClient();
  const row = formRow(fd, PROJECT);
  if (id) {
    const { error } = await supabase.from("projects").update(row).eq("id", id);
    if (error) fail(back, error.message);
    revalidatePath("/", "layout");
    redirect(`/projects/${id}`);
  }
  const { data, error } = await supabase.from("projects").insert(row).select("id").single();
  if (error) fail(back, error.message);
  revalidatePath("/", "layout");
  redirect(`/projects/${data.id}`);
}

export async function saveWorkItem(fd: FormData) {
  const id = (fd.get("id") as string) || null;
  const row = formRow(fd, WORK_ITEM);
  const progress = fd.get("progress");
  row.progress = progress === null || progress === "" ? 0 : Number(progress) / 100;
  row.visible_to_client = fd.get("visible_to_client") === "on";
  const back = `/projects/${row.project_id}`;
  await save("work_items", row, id, back);
  revalidatePath("/", "layout");
  redirect(back);
}

export async function createPurchase(fd: FormData) {
  const row = formRow(fd, PURCHASE);
  const back = (fd.get("back") as string) || "/purchasing";
  await save("purchases", row, null, back);
  revalidatePath("/", "layout");
  redirect(back);
}

/** Procurement / accounts updates, one field group at a time (mirrors the Coda buttons). */
export async function updatePurchase(fd: FormData) {
  const id = String(fd.get("id"));
  const back = (fd.get("back") as string) || "/purchasing";
  const row: Record<string, unknown> = {};
  for (const k of ["status","payment_status","supplier_id","po_number","amount","invoice_no","procurement_owner_id"]) {
    if (fd.has(k)) { const v = fd.get(k); row[k] = v === "" ? null : v; }
  }
  await save("purchases", row, id, back);
  revalidatePath("/", "layout");
  redirect(back);
}

export async function createSiteTask(fd: FormData) {
  const row = formRow(fd, SITE_TASK);
  const back = (fd.get("back") as string) || "/site-tasks";
  await save("site_tasks", row, null, back);
  revalidatePath("/", "layout");
  redirect(back);
}

export async function setSiteTaskStatus(fd: FormData) {
  const id = String(fd.get("id"));
  const back = (fd.get("back") as string) || "/site-tasks";
  await save("site_tasks", { status: fd.get("status") }, id, back);
  revalidatePath("/", "layout");
  redirect(back);
}

export async function savePerson(fd: FormData) {
  const id = (fd.get("id") as string) || null;
  const row: Record<string, unknown> = formRow(fd, PERSON);
  if (row.email) row.email = String(row.email).trim().toLowerCase();
  row.active = fd.get("active") !== "off";
  await save("people", row, id, "/people");
  revalidatePath("/people");
  redirect("/people");
}

export async function setProjectMembers(fd: FormData) {
  const projectId = String(fd.get("project_id"));
  const ids = fd.getAll("person_id").map(String);
  const supabase = await createClient();
  const back = `/projects/${projectId}`;
  const del = await supabase.from("project_members").delete().eq("project_id", projectId);
  if (del.error) fail(back, del.error.message);
  if (ids.length) {
    const ins = await supabase.from("project_members").insert(ids.map((person_id) => ({ project_id: projectId, person_id })));
    if (ins.error) fail(back, ins.error.message);
  }
  revalidatePath(back);
  redirect(back);
}

const VENDOR = ["name","role","company","vendor_category","contact_person","phone","email","tax_id","commercial_reg","address","payment_terms","notes"];

export async function saveVendor(fd: FormData) {
  const id = (fd.get("id") as string) || null;
  const row: Record<string, unknown> = formRow(fd, VENDOR);
  if (row.email) row.email = String(row.email).trim().toLowerCase();
  row.trades = fd.getAll("trades").map(String);
  const rating = fd.get("rating");
  row.rating = rating ? Number(rating) : null;
  row.active = fd.get("active") !== "off";
  await save("people", row, id, "/procurement/vendors");
  revalidatePath("/", "layout");
  redirect("/procurement/vendors");
}
