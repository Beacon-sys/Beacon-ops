// Loads management-defined custom columns and their values, and merges them into a database's rows.
import type { Column, Row } from "@/components/database";
import type { createClient } from "@/lib/supabase/server";

export type CustomField = { id: string; table_name: string; label: string; type: string; options: string[]; position: number; client_visible: boolean };

export async function withCustomFields(supabase: Awaited<ReturnType<typeof createClient>>, table: string, columns: Column[], rows: Row[],
  editable = true, clientOnly = false): Promise<{ columns: Column[]; rows: Row[] }> {
  const { data: fields } = await supabase.from("custom_fields").select("*").eq("table_name", table).order("position").order("created_at");
  const list = ((fields ?? []) as CustomField[]).filter((f) => !clientOnly || f.client_visible);
  if (!list.length) return { columns, rows };
  const { data: values } = await supabase.from("custom_values").select("field_id,row_id,value").in("field_id", list.map((f) => f.id));
  const byRow = new Map<string, Record<string, unknown>>();
  const type = new Map(list.map((f) => [f.id, f.type]));
  for (const v of values ?? []) {
    const t = type.get(v.field_id);
    const parsed = v.value === null ? null : t === "number" || t === "money" ? Number(v.value) : t === "checkbox" ? v.value === "true" : v.value;
    byRow.set(v.row_id, { ...byRow.get(v.row_id), [`cf:${v.field_id}`]: parsed });
  }
  return {
    columns: [...columns, ...list.map((f): Column => ({
      key: `cf:${f.id}`, label: f.label, type: f.type as Column["type"], editable,
      options: f.type === "select" ? f.options.map((o) => ({ value: o, label: o })) : undefined,
      sum: f.type === "money" || undefined,
      custom: { id: f.id, options: f.options, client_visible: f.client_visible },
    }))],
    rows: rows.map((r) => ({ ...r, ...byRow.get(r.id) })),
  };
}
