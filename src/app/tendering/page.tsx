import { redirect } from "next/navigation";
import Link from "next/link";
import { requireMe, allowed, money, date } from "@/lib/data";
import { PageTitle, Card, Table, Badge, Stat, ButtonLink } from "@/components/ui";

export default async function Tendering() {
  const { supabase, me } = await requireMe();
  if (!allowed(me.role, ["tendering"])) redirect("/");

  const [{ data: tenders }, { data: recent }] = await Promise.all([
    supabase.from("project_summary").select("id,name,code,location,contract_value,work_item_count,created_at,client_id")
      .eq("status", "tendering").order("created_at", { ascending: false }),
    supabase.from("projects").select("id,name,status,start_date").eq("status", "active")
      .order("start_date", { ascending: false, nullsFirst: false }).limit(5),
  ]);
  const { data: clients } = await supabase.from("people").select("id,name").in("role", ["client"]);
  const clientName = (id: string | null) => clients?.find((c) => c.id === id)?.name ?? "";
  const total = (tenders ?? []).reduce((s, t) => s + Number(t.contract_value ?? 0), 0);

  return (
    <>
      <PageTitle title="Tendering" sub="Projects being priced. When a tender is won, set its status to Active to hand it to Operations."
        action={<ButtonLink href="/projects/new">New tender</ButtonLink>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Open tenders" value={tenders?.length ?? 0} />
        <Stat label="Total tender value" value={money(total) || "—"} />
        <Stat label="Recently won" value={recent?.length ?? 0} />
      </div>
      <Card title="Open tenders">
        <Table head={["Tender", "Client", "Location", "BOQ items", "Value", "Created"]} empty={!tenders?.length}>
          {(tenders ?? []).map((t) => (
            <tr key={t.id}>
              <td><Link className="link" href={`/projects/${t.id}`}>{t.name}</Link>{t.code && <span className="ml-2 text-muted">{t.code}</span>}</td>
              <td>{clientName(t.client_id)}</td>
              <td>{t.location}</td>
              <td className="tabular-nums">{t.work_item_count}</td>
              <td className="tabular-nums">{money(t.contract_value)}</td>
              <td>{date(t.created_at?.slice(0, 10))}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title="Won tenders (handed to Operations)" id="won">
        <Table head={["Project", "Status", "Start"]} empty={!recent?.length}>
          {(recent ?? []).map((p) => (
            <tr key={p.id}>
              <td><Link className="link" href={`/projects/${p.id}`}>{p.name}</Link></td>
              <td><Badge set="project_status" value={p.status} /></td>
              <td>{date(p.start_date)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
