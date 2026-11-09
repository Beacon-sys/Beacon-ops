// Meetings with their action counts, for a project or for every project.
import type { Row } from "@/components/database";
import type { createClient } from "@/lib/supabase/server";

export async function loadMeetings(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string | null): Promise<Row[]> {
  let q = supabase.from("meetings").select("*, project:projects(name), actions:site_tasks(id,status)").order("meeting_date", { ascending: false });
  if (projectId) q = q.eq("project_id", projectId);
  const { data } = await q;
  type A = { id: string; status: string };
  return (data ?? []).map((m) => ({
    ...m, project_name: (m.project as { name: string } | null)?.name,
    action_count: ((m.actions ?? []) as A[]).length, open_actions: ((m.actions ?? []) as A[]).filter((a) => a.status !== "done").length,
  })) as Row[];
}
