"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };
const done = (error: { message: string } | null): Result => { revalidatePath("/", "layout"); return error ? { error: error.message } : {}; };

export async function createPage(formData: FormData) {
  const parent = (formData.get("parent_id") as string) || null;
  const supabase = await createClient();
  const { data: last } = await (parent
    ? supabase.from("pages").select("position").eq("parent_id", parent)
    : supabase.from("pages").select("position").is("parent_id", null)).order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from("pages").insert({ parent_id: parent, title: "Untitled", position: (last?.position ?? 0) + 1 }).select("id").single();
  if (error) redirect(`/pages?error=${encodeURIComponent(error.message)}`);
  // Start every page with a text block so there is somewhere to type.
  await supabase.from("page_blocks").insert({ page_id: data.id, kind: "text", position: 0, body: "" });
  revalidatePath("/", "layout");
  redirect(`/pages/${data.id}`);
}

export async function updatePage(id: string, patch: { title?: string; icon?: string | null; parent_id?: string | null }): Promise<Result> {
  const supabase = await createClient();
  if (patch.parent_id === id) return { error: "A page can't be inside itself." };
  if (patch.parent_id) {
    // Refuse to move a page under one of its own sub-pages.
    let cur: string | null = patch.parent_id;
    for (let i = 0; cur && i < 50; i++) {
      if (cur === id) return { error: "A page can't go inside one of its own sub-pages." };
      const { data }: { data: { parent_id: string | null } | null } = await supabase.from("pages").select("parent_id").eq("id", cur).maybeSingle();
      cur = data?.parent_id ?? null;
    }
  }
  const { error } = await supabase.from("pages").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  return done(error);
}

export async function deletePage(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("pages").select("parent_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("pages").delete().eq("id", id);
  revalidatePath("/", "layout");
  if (error) return { error: error.message };
  redirect(data?.parent_id ? `/pages/${data.parent_id}` : "/pages");
}

export async function addBlock(pageId: string, kind: "text" | "view", after: number, source?: string, projectId?: string | null): Promise<Result> {
  const supabase = await createClient();
  const { data: blocks } = await supabase.from("page_blocks").select("id,position").eq("page_id", pageId).order("position");
  // Make room after the given position.
  for (const b of blocks ?? []) if (b.position > after) await supabase.from("page_blocks").update({ position: b.position + 1 }).eq("id", b.id);
  const { error } = await supabase.from("page_blocks").insert({
    page_id: pageId, kind, position: after + 1, body: kind === "text" ? "" : null,
    source: kind === "view" ? source ?? "work_items" : null, project_id: projectId || null, settings: kind === "view" ? { view: "table" } : {},
  });
  return done(error);
}

export async function updateBlock(id: string, patch: { title?: string | null; body?: string; source?: string; project_id?: string | null; settings?: Record<string, unknown> }): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("page_blocks").update(patch).eq("id", id);
  return done(error);
}

export async function moveBlock(pageId: string, id: string, dir: -1 | 1): Promise<Result> {
  const supabase = await createClient();
  const { data } = await supabase.from("page_blocks").select("id,position").eq("page_id", pageId).order("position").order("created_at");
  const list = data ?? [];
  const i = list.findIndex((b) => b.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return {};
  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, b] of list.entries()) await supabase.from("page_blocks").update({ position: k }).eq("id", b.id);
  return done(null);
}

export async function deleteBlock(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("page_blocks").delete().eq("id", id);
  return done(error);
}
