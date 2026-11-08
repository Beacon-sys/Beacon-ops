import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMe, allowed, money, date } from "@/lib/data";
import { PageTitle, Card, Table, Badge, Progress } from "@/components/ui";
import { ContractForm } from "@/components/contract-form";
import { ErrorNote } from "@/components/error-note";

export default async function Contracts({ searchParams }: { searchParams: Promise<{ project?: string; error?: string }> }) {
  const { supabase, me } = await requireMe();
  if (!allowed(me.role, ["procurement", "accountant", "site_ops", "tendering"])) redirect("/");
  const sp = await searchParams;
  const canEdit = me.role === "management" || me.role === "procurement";

  let q = supabase.from("contract_summary").select("*, project:projects(name), vendor:people(name)").order("created_at", { ascending: false });
  if (sp.project) q = q.eq("project_id", sp.project);
  const [{ data }, { data: projects }, { data: vendors }] = await Promise.all([
    q,
    supabase.from("projects").select("id,name").neq("status", "closed").order("name"),
    supabase.from("people").select("id,name").in("role", ["contractor", "supplier"]).eq("active", true).order("name"),
  ]);
  type Row = { id: string; number: string | null; title: string; status: string; start_date: string | null; finish_date: string | null;
    item_count: number; contract_value: number; progress: number | null; project: { name: string } | null; vendor: { name: string } | null };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageTitle title="Contracts" sub="Subcontracts and supply agreements, with the work items each one covers" />
      <ErrorNote error={sp.error} />
      <form action="/procurement/contracts" className="mb-4 flex gap-2">
        <select name="project" defaultValue={sp.project ?? ""} className="input w-64">
          <option value="">All projects</option>
          {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn btn-sm">Filter</button>
      </form>
      <Card>
        <Table head={["Contract", "Contractor", "Project", "Items", "Value", "Start", "Finish", "Progress", "Status"]} empty={!rows.length}>
          {rows.map((c) => (
            <tr key={c.id}>
              <td><Link className="link" href={`/procurement/contracts/${c.id}`}>{c.number ? `${c.number} · ` : ""}{c.title}</Link></td>
              <td>{c.vendor?.name}</td>
              <td className="text-muted">{c.project?.name}</td>
              <td className="tabular-nums">{c.item_count}</td>
              <td className="tabular-nums">{money(c.contract_value)}</td>
              <td>{date(c.start_date)}</td>
              <td>{date(c.finish_date)}</td>
              <td><Progress v={c.progress} /></td>
              <td><Badge set="contract_status" value={c.status} /></td>
            </tr>
          ))}
        </Table>
      </Card>
      {canEdit && (
        <Card title="New contract" id="new">
          {(projects ?? []).length && (vendors ?? []).length
            ? <ContractForm projects={projects ?? []} vendors={vendors ?? []} />
            : <p className="text-sm text-muted">Add a project and a contractor (Vendors & contractors) first.</p>}
        </Card>
      )}
    </>
  );
}
