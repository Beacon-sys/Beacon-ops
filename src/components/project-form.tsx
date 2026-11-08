import { saveProject } from "@/app/actions";
import { Field, Select, PersonSelect } from "@/components/ui";

type P = { id: string; name: string; role: string };

export function ProjectForm({ project, people }: { project?: Record<string, string | number | null>; people: P[] }) {
  const v = (k: string) => (project?.[k] ?? "") as string;
  const of = (...roles: string[]) => people.filter((p) => roles.includes(p.role));
  return (
    <form action={saveProject} className="grid gap-4 rounded-xl border border-line bg-surface p-5 sm:grid-cols-2">
      {project && <input type="hidden" name="id" value={v("id")} />}
      <Field label="Project name"><input name="name" required defaultValue={v("name")} className="input" /></Field>
      <Field label="Code"><input name="code" defaultValue={v("code")} className="input" /></Field>
      <Field label="Client"><PersonSelect name="client_id" people={of("client")} defaultValue={v("client_id")} /></Field>
      <Field label="Consultant"><PersonSelect name="consultant_id" people={of("consultant")} defaultValue={v("consultant_id")} /></Field>
      <Field label="Project manager"><PersonSelect name="project_manager_id" people={of("management", "site_ops")} defaultValue={v("project_manager_id")} /></Field>
      <Field label="Location"><input name="location" defaultValue={v("location")} className="input" /></Field>
      <Field label="Status"><Select name="status" set="project_status" defaultValue={v("status") || "tendering"} /></Field>
      <Field label="Contract value (EGP)"><input name="contract_value" type="number" step="0.01" defaultValue={v("contract_value")} className="input" /></Field>
      <Field label="Start date"><input name="start_date" type="date" defaultValue={v("start_date")} className="input" /></Field>
      <Field label="Planned finish"><input name="planned_finish" type="date" defaultValue={v("planned_finish")} className="input" /></Field>
      <div className="sm:col-span-2"><button className="btn btn-primary">{project ? "Save changes" : "Create project"}</button></div>
    </form>
  );
}
