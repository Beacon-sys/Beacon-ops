"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formRow } from "@/lib/data";

const PROJECT = ["name","code","client_id","consultant_id","project_manager_id","location","status","start_date","planned_finish","contract_value"];
const WORK_ITEM = ["project_id","name","boq_ref","item_type","category","trade","area","status","planned_start","planned_finish","actual_start","actual_finish","quantity","unit","notes"];
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
  const supabase = await createClient();
  let id = (fd.get("id") as string) || null;
  const row = formRow(fd, WORK_ITEM);
  const progress = fd.get("progress");
  row.progress = progress === null || progress === "" ? 0 : Number(progress) / 100;
  row.visible_to_client = fd.get("visible_to_client") === "on";
  if (!fd.get("keep_beacon_rate")) { const r = fd.get("beacon_rate"); row.beacon_rate = r ? String(r) : null; }
  const back = (fd.get("back") as string) || `/projects/${row.project_id}`;

  if (id) {
    const { error } = await supabase.from("work_items").update(row).eq("id", id);
    if (error) fail(back, error.message);
  } else {
    const { data, error } = await supabase.from("work_items").insert(row).select("id").single();
    if (error) fail(back, error.message);
    id = data.id as string;
  }

  if (fd.has("cost_rate")) {
    const cost = fd.get("cost_rate");
    const { error } = await supabase.from("work_item_costs").upsert({
      work_item_id: id, cost_rate: cost ? String(cost) : null,
      vendor_id: (fd.get("cost_vendor_id") as string) || null, updated_at: new Date().toISOString(),
    });
    if (error) fail(back, `Saved, but the cost rate wasn't: ${error.message}`);
  }

  if (fd.get("team_submitted")) {
    const team = fd.getAll("team").map(String);
    const del = await supabase.from("work_item_people").delete().eq("work_item_id", id);
    if (del.error) fail(back, `Saved, but the team wasn't: ${del.error.message}`);
    if (team.length) {
      const ins = await supabase.from("work_item_people").insert(team.map((person_id) => ({ work_item_id: id, person_id })));
      if (ins.error) fail(back, `Saved, but the team wasn't: ${ins.error.message}`);
    }
  }
  revalidatePath("/", "layout");
  redirect(back);
}

const SUBMITTAL = ["project_id","number","title","kind","revision","status","submitted_on","due_back","returned_on","link","notes"];

export async function saveSubmittal(fd: FormData) {
  const supabase = await createClient();
  const id = (fd.get("id") as string) || null;
  const back = (fd.get("back") as string) || "/submittals";
  const row = formRow(fd, SUBMITTAL);
  if (row.revision === null) row.revision = 0;
  let sid = id;
  if (id) {
    const { error } = await supabase.from("submittals").update(row).eq("id", id);
    if (error) fail(back, error.message);
  } else {
    const { data, error } = await supabase.from("submittals").insert(row).select("id").single();
    if (error) fail(back, error.message);
    sid = data.id as string;
  }
  const wi = fd.get("work_item_id") as string;
  if (wi && sid) {
    const { error } = await supabase.from("work_item_submittals").upsert({ work_item_id: wi, submittal_id: sid });
    if (error) fail(back, error.message);
  }
  revalidatePath("/", "layout");
  redirect(back);
}

export async function linkSubmittal(fd: FormData) {
  const supabase = await createClient();
  const back = String(fd.get("back"));
  const row = { work_item_id: String(fd.get("work_item_id")), submittal_id: String(fd.get("submittal_id")) };
  const { error } = fd.get("unlink")
    ? await supabase.from("work_item_submittals").delete().match(row)
    : await supabase.from("work_item_submittals").upsert(row);
  if (error) fail(back, error.message);
  revalidatePath(back);
  redirect(back);
}

export async function addAttachmentLink(fd: FormData) {
  const supabase = await createClient();
  const back = String(fd.get("back"));
  const { data: { user } } = await supabase.auth.getUser();
  const me = user ? (await supabase.from("people").select("id").eq("user_id", user.id).maybeSingle()).data : null;
  let url = String(fd.get("url") ?? "").trim();
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  const { error } = await supabase.from("attachments").insert({
    project_id: fd.get("project_id"), work_item_id: fd.get("work_item_id") || null,
    file_name: String(fd.get("file_name") || url), kind: fd.get("kind") || "other", url,
    visible_to_client: fd.get("visible_to_client") === "on", uploaded_by_id: me?.id ?? null,
  });
  if (error) fail(back, error.message);
  revalidatePath(back);
  redirect(back);
}

export async function deleteAttachment(fd: FormData) {
  const supabase = await createClient();
  const back = String(fd.get("back"));
  const { error } = await supabase.from("attachments").delete().eq("id", String(fd.get("id")));
  if (error) fail(back, error.message);
  revalidatePath(back);
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

export async function saveCostRate(fd: FormData) {
  const supabase = await createClient();
  const back = String(fd.get("back"));
  const cost = fd.get("cost_rate");
  const { error } = await supabase.from("work_item_costs").upsert({
    work_item_id: String(fd.get("work_item_id")), cost_rate: cost ? String(cost) : null,
    vendor_id: (fd.get("cost_vendor_id") as string) || null, updated_at: new Date().toISOString(),
  });
  if (error) fail(back, error.message);
  revalidatePath("/", "layout");
  redirect(back);
}

const CONTRACT = ["project_id","vendor_id","number","title","status","start_date","finish_date","retention_pct","link","notes"];

export async function saveContract(fd: FormData) {
  const supabase = await createClient();
  const id = (fd.get("id") as string) || null;
  const back = (fd.get("back") as string) || "/procurement/contracts";
  const row = formRow(fd, CONTRACT);
  if (id) {
    const { error } = await supabase.from("contracts").update(row).eq("id", id);
    if (error) fail(back, error.message);
    revalidatePath("/", "layout");
    redirect(back);
  }
  const { data, error } = await supabase.from("contracts").insert(row).select("id").single();
  if (error) fail(back, error.message);
  revalidatePath("/", "layout");
  redirect(`/procurement/contracts/${data.id}`);
}

/** Add or update work items on a contract. Rows arrive as item_<work_item_id>_rate etc. */
export async function saveContractItems(fd: FormData) {
  const supabase = await createClient();
  const contractId = String(fd.get("contract_id"));
  const back = `/procurement/contracts/${contractId}`;
  const ids = fd.getAll("work_item_id").map(String);
  const rows = ids.map((wid) => {
    const g = (k: string) => { const v = fd.get(`${k}_${wid}`); return v === null || v === "" ? null : String(v); };
    return { contract_id: contractId, work_item_id: wid, rate: g("rate"), quantity: g("quantity"), start_date: g("start_date"), finish_date: g("finish_date") };
  });
  if (rows.length) {
    const { error } = await supabase.from("contract_items").upsert(rows);
    if (error) fail(back, error.message);
  }
  revalidatePath("/", "layout");
  redirect(back);
}

export async function removeContractItem(fd: FormData) {
  const supabase = await createClient();
  const contractId = String(fd.get("contract_id"));
  const back = `/procurement/contracts/${contractId}`;
  const { error } = await supabase.from("contract_items").delete()
    .match({ contract_id: contractId, work_item_id: String(fd.get("remove_id")) });
  if (error) fail(back, error.message);
  revalidatePath("/", "layout");
  redirect(back);
}
