import { saveContract } from "@/app/actions";
import { Field, Select } from "@/components/ui";

type Opt = { id: string; name: string };

export function ContractForm({ c, projects, vendors, back }: {
  c?: Record<string, unknown>; projects: Opt[]; vendors: Opt[]; back?: string;
}) {
  const v = (k: string) => (c?.[k] ?? "") as string;
  return (
    <form action={saveContract} className="grid gap-3 sm:grid-cols-3">
      {c && <input type="hidden" name="id" value={v("id")} />}
      {back && <input type="hidden" name="back" value={back} />}
      <Field label="Project">
        <select name="project_id" required defaultValue={v("project_id")} className="input">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Contractor / supplier">
        <select name="vendor_id" required defaultValue={v("vendor_id")} className="input">
          {vendors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Contract no."><input name="number" defaultValue={v("number")} placeholder="SC-001" className="input" /></Field>
      <div className="sm:col-span-2"><Field label="Title / scope"><input name="title" required defaultValue={v("title")} placeholder="e.g. Earthworks and substructure" className="input" /></Field></div>
      <Field label="Status"><Select name="status" set="contract_status" defaultValue={v("status") || "draft"} /></Field>
      <Field label="Start"><input name="start_date" type="date" defaultValue={v("start_date")} className="input" /></Field>
      <Field label="Finish"><input name="finish_date" type="date" defaultValue={v("finish_date")} className="input" /></Field>
      <Field label="Retention %"><input name="retention_pct" type="number" step="0.5" defaultValue={c ? v("retention_pct") : "5"} className="input" /></Field>
      <div className="sm:col-span-3"><Field label="Signed contract link"><input name="link" type="url" defaultValue={v("link")} placeholder="https://drive.google.com/…" className="input" /></Field></div>
      <div className="sm:col-span-3"><Field label="Notes"><textarea name="notes" rows={2} defaultValue={v("notes")} className="input" /></Field></div>
      <div className="sm:col-span-3"><button className="btn btn-primary">{c ? "Save contract" : "Create contract"}</button></div>
    </form>
  );
}
