"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };
const done = (error?: { message: string } | null): Result => {
  revalidatePath("/timeline");
  return error ? { error: error.message } : {};
};

export async function setDates(kind: "wi" | "task", id: string, start: string | null, end: string | null): Promise<Result> {
  const supabase = await createClient();
  const { error } = kind === "wi"
    ? await supabase.from("work_items").update({ planned_start: start, planned_finish: end }).eq("id", id)
    : await supabase.from("site_tasks").update({ planned_start: start, due: end }).eq("id", id);
  return done(error);
}

export async function addDependency(predecessor_id: string, successor_id: string, kind = "FS", lag_days = 0): Promise<Result> {
  if (predecessor_id === successor_id) return { error: "An item can't depend on itself." };
  const supabase = await createClient();
  const { error } = await supabase.from("work_item_dependencies").upsert({ predecessor_id, successor_id, kind, lag_days });
  return done(error);
}

export async function removeDependency(predecessor_id: string, successor_id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("work_item_dependencies").delete().match({ predecessor_id, successor_id });
  return done(error);
}

export async function saveMilestone(m: { id?: string; project_id: string; name: string; planned_date: string; actual_date?: string | null }): Promise<Result> {
  const supabase = await createClient();
  const { error } = m.id
    ? await supabase.from("milestones").update({ name: m.name, planned_date: m.planned_date, actual_date: m.actual_date ?? null }).eq("id", m.id)
    : await supabase.from("milestones").insert({ project_id: m.project_id, name: m.name, planned_date: m.planned_date });
  return done(error);
}

export async function deleteMilestone(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").delete().eq("id", id);
  return done(error);
}

/** Save many planned-date changes at once (used by "Reschedule from dependencies"). */
export async function setManyDates(changes: { id: string; start: string; end: string }[]): Promise<Result> {
  const supabase = await createClient();
  for (const c of changes) {
    const { error } = await supabase.from("work_items").update({ planned_start: c.start, planned_finish: c.end }).eq("id", c.id);
    if (error) return done(error);
  }
  return done();
}
