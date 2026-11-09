import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe, isInternal } from "@/lib/data";
import { loadProject } from "@/lib/project-db";
import { Database } from "@/components/database";
import { ProjectHeader } from "@/components/project-tabs";

export default async function PurchasingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, me } = await requireMe();
  if (!isInternal(me.role)) redirect(`/projects/${id}`);
  const d = await loadProject(supabase, me, id, { purchases: true });
  return (
    <div className="full-bleed">
      <ProjectHeader id={id} name={d.project.name} code={d.project.code} current="purchasing" internal />
      <Database id={`purchases:${id}`} table="purchases" rows={d.buying.rows} columns={d.buying.columns} titleKey="request"
        editable={d.canBuy} creatable={["management", "procurement", "site_ops"].includes(me.role)} createDefaults={{ project_id: id }}
        fieldsTable="purchases" canManageFields={me.role === "management"} views={["table", "board", "calendar"]} fullPage />
      <p className="mt-2 text-xs text-muted">Approvals and PO steps are on the <Link className="link" href="/procurement?view=all">Procurement</Link> page.</p>
    </div>
  );
}
