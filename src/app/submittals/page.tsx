import Link from "next/link";
import { requireMe, isInternal, date, label } from "@/lib/data";
import { PageTitle, Card, Table, Badge, Field, Select } from "@/components/ui";
import { saveSubmittal } from "@/app/actions";
import { ErrorNote } from "@/components/error-note";

type Sub = {
  id: string; project_id: string; number: string | null; title: string; kind: string; revision: number; status: string;
  submitted_on: string | null; due_back: string | null; returned_on: string | null; link: string | null; notes: string | null;
  project: { name: string } | null; items: { work_item: { id: string; name: string; boq_ref: string | null } | null }[];
};

export default async function Submittals({ searchParams }: {
  searchParams: Promise<{ project?: string; status?: string; error?: string }>;
}) {
  const { supabase, me } = await requireMe();
  const sp = await searchParams;
  const internal = isInternal(me.role);
  const canEdit = ["management", "site_ops", "tendering", "procurement"].includes(me.role);
  const { data: projects } = await supabase.from("projects").select("id,name").neq("status", "closed").order("name");
  const projectId = sp.project ?? "";

  let q = supabase.from("submittals")
    .select("*, project:projects(name), items:work_item_submittals(work_item:work_items(id,name,boq_ref))")
    .order("number", { nullsFirst: false });
  if (projectId) q = q.eq("project_id", projectId);
  if (sp.status === "open") q = q.in("status", ["draft", "submitted", "revise_resubmit"]);
  const { data } = await q;
  const subs = (data ?? []) as unknown as Sub[];
  const today = new Date().toISOString().slice(0, 10);
  const back = `/submittals${projectId ? `?project=${projectId}` : ""}`;

  return (
    <>
      <PageTitle title="Submittals" sub="Materials, shop drawings and method statements sent for approval" />
      <ErrorNote error={sp.error} />
      <form action="/submittals" className="mb-4 flex flex-wrap gap-2">
        <select name="project" defaultValue={projectId} className="input w-64">
          <option value="">All projects</option>
          {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="input w-44">
          <option value="">Any status</option><option value="open">Still open</option>
        </select>
        <button className="btn btn-sm">Filter</button>
      </form>

      <Card>
        <Table head={["No.", "Title", ...(projectId ? [] : ["Project"]), "Work items", "Type", "Rev", "Status", "Submitted", "Due back", "Returned", ...(canEdit ? [""] : [])]} empty={!subs.length}>
          {subs.map((s) => {
            const overdue = s.status === "submitted" && s.due_back && s.due_back < today;
            return (
              <tr key={s.id}>
                <td className="whitespace-nowrap">{s.number}</td>
                <td>{s.link ? <a className="link" href={s.link} target="_blank" rel="noreferrer">{s.title}</a> : s.title}</td>
                {!projectId && <td className="text-muted">{s.project?.name}</td>}
                <td className="text-xs">
                  {s.items.map((i) => i.work_item && (
                    <div key={i.work_item.id}><Link className="link" href={`/work-items/${i.work_item.id}`}>{i.work_item.boq_ref ?? i.work_item.name}</Link></div>
                  ))}
                </td>
                <td>{label("submittal_kind", s.kind)}</td>
                <td>{s.revision}</td>
                <td><Badge set="submittal_status" value={s.status} /></td>
                <td>{date(s.submitted_on)}</td>
                <td className={overdue ? "font-medium text-[var(--bad)]" : ""}>{date(s.due_back)}</td>
                <td>{date(s.returned_on)}</td>
                {canEdit && (
                  <td className="text-right">
                    <details className="relative inline-block text-left">
                      <summary className="btn btn-sm list-none">Update</summary>
                      <div className="absolute right-0 z-10 mt-1 w-[min(90vw,520px)] rounded-xl border border-line bg-surface p-4 shadow-lg">
                        <SubmittalForm s={s} back={back} />
                      </div>
                    </details>
                  </td>
                )}
              </tr>
            );
          })}
        </Table>
      </Card>

      {canEdit && internal && (
        <Card title="New submittal">
          {projectId ? <SubmittalForm projectId={projectId} back={back} /> : <p className="text-sm text-muted">Choose a project above to add a submittal, or add one from a work item&apos;s page.</p>}
        </Card>
      )}
    </>
  );
}

function SubmittalForm({ s, projectId, back }: { s?: Sub; projectId?: string; back: string }) {
  const v = (k: keyof Sub) => (s?.[k] ?? "") as string;
  return (
    <form action={saveSubmittal} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="project_id" value={s?.project_id ?? projectId} />
      {s && <input type="hidden" name="id" value={s.id} />}
      <Field label="Number"><input name="number" defaultValue={v("number")} placeholder="SUB-001" className="input" /></Field>
      <div className="sm:col-span-2"><Field label="Title"><input name="title" required defaultValue={v("title")} className="input" /></Field></div>
      <Field label="Type"><Select name="kind" set="submittal_kind" defaultValue={v("kind") || "material"} /></Field>
      <Field label="Status"><Select name="status" set="submittal_status" defaultValue={v("status") || "draft"} /></Field>
      <Field label="Revision"><input name="revision" type="number" min={0} defaultValue={s?.revision ?? 0} className="input" /></Field>
      <Field label="Submitted on"><input name="submitted_on" type="date" defaultValue={v("submitted_on")} className="input" /></Field>
      <Field label="Response due"><input name="due_back" type="date" defaultValue={v("due_back")} className="input" /></Field>
      <Field label="Returned on"><input name="returned_on" type="date" defaultValue={v("returned_on")} className="input" /></Field>
      <div className="sm:col-span-3"><Field label="Document link"><input name="link" type="url" defaultValue={v("link")} placeholder="https://drive.google.com/…" className="input" /></Field></div>
      <div className="sm:col-span-3"><Field label="Notes"><textarea name="notes" rows={2} defaultValue={v("notes")} className="input" /></Field></div>
      <div className="sm:col-span-3"><button className="btn btn-primary">{s ? "Save" : "Add submittal"}</button></div>
    </form>
  );
}
