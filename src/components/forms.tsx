import { saveWorkItem, createPurchase, createSiteTask } from "@/app/actions";
import { Field, Select, PersonSelect } from "@/components/ui";

type Person = { id: string; name: string; role: string };
type Opt = { id: string; name: string };

export function WorkItemForm({ projectId, item, people, categories = [], vendors = [], team = [], canCost, canPrice, back }: {
  projectId: string; item?: Record<string, unknown>; people: Person[]; categories?: string[];
  vendors?: Opt[]; team?: string[]; canCost: boolean; canPrice: boolean; back?: string;
}) {
  const v = (k: string) => (item?.[k] ?? "") as string;
  const staff = people.filter((p) => ["management", "site_ops", "tendering", "procurement"].includes(p.role));
  const listId = `cats-${projectId}`;
  return (
    <form action={saveWorkItem} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="project_id" value={projectId} />
      {back && <input type="hidden" name="back" value={back} />}
      {item && <input type="hidden" name="id" value={v("id")} />}
      <Field label="BOQ No."><input name="boq_ref" defaultValue={v("boq_ref")} className="input" /></Field>
      <Field label="Type"><Select name="item_type" set="item_type" defaultValue={v("item_type") || "boq"} /></Field>
      <Field label="Category">
        <input name="category" list={listId} defaultValue={v("category")} placeholder="e.g. Substructure" className="input" />
        <datalist id={listId}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="Trade"><Select name="trade" set="trade" blank defaultValue={v("trade")} /></Field>
      <div className="sm:col-span-4"><Field label="Item description"><textarea name="name" required rows={2} defaultValue={v("name")} className="input" /></Field></div>
      <Field label="Quantity"><input name="quantity" type="number" step="0.01" defaultValue={v("quantity")} className="input" /></Field>
      <Field label="Unit"><input name="unit" placeholder="m³, m², nr…" defaultValue={v("unit")} className="input" /></Field>
      {canCost ? (
        <>
          <Field label="Cost rate (EGP)"><input name="cost_rate" type="number" step="0.01" defaultValue={v("cost_rate")} className="input" /></Field>
          <Field label="Cost rate from">
            <select name="cost_vendor_id" defaultValue={v("cost_vendor_id")} className="input">
              <option value="">—</option>
              {vendors.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        </>
      ) : <div className="hidden sm:col-span-2 sm:block" />}
      {canPrice
        ? <Field label="Beacon's rate (EGP)"><input name="beacon_rate" type="number" step="0.01" defaultValue={v("beacon_rate")} className="input" /></Field>
        : <input type="hidden" name="keep_beacon_rate" value="1" />}
      <Field label="Status"><Select name="status" set="work_item_status" defaultValue={v("status") || "not_started"} /></Field>
      <Field label="Progress %">
        <input name="progress" type="number" min={0} max={100} step={5}
          defaultValue={item ? Math.round(Number(item.progress ?? 0) * 100) : 0} className="input" />
      </Field>
      <Field label="Area / zone"><input name="area" defaultValue={v("area")} className="input" /></Field>
      <Field label="Planned start"><input name="planned_start" type="date" defaultValue={v("planned_start")} className="input" /></Field>
      <Field label="Planned finish"><input name="planned_finish" type="date" defaultValue={v("planned_finish")} className="input" /></Field>
      <Field label="Actual start"><input name="actual_start" type="date" defaultValue={v("actual_start")} className="input" /></Field>
      <Field label="Actual finish"><input name="actual_finish" type="date" defaultValue={v("actual_finish")} className="input" /></Field>
      <div className="sm:col-span-4">
        <span className="text-sm text-muted">Team members assigned</span>
        <input type="hidden" name="team_submitted" value="1" />
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {staff.length ? staff.map((p) => (
            <label key={p.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="team" value={p.id} defaultChecked={team.includes(p.id)} />{p.name}
            </label>
          )) : <span className="text-sm text-muted">Add staff on the People page first.</span>}
        </div>
      </div>
      <div className="sm:col-span-3"><Field label="Notes"><textarea name="notes" rows={2} defaultValue={v("notes")} className="input" /></Field></div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="visible_to_client" defaultChecked={item ? Boolean(item.visible_to_client) : true} />
        Visible to client
      </label>
      <div className="sm:col-span-4"><button className="btn btn-primary">{item ? "Save work item" : "Add work item"}</button></div>
    </form>
  );
}

export function PurchaseRequestForm({ projects, workItems, suppliers, projectId, back }: {
  projects: Opt[]; workItems: (Opt & { project_id: string })[]; suppliers: Opt[]; projectId?: string; back: string;
}) {
  return (
    <form action={createPurchase} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="back" value={back} />
      {projectId
        ? <input type="hidden" name="project_id" value={projectId} />
        : <Field label="Project"><PersonSelect name="project_id" people={projects} blank={false} /></Field>}
      <div className={projectId ? "sm:col-span-2" : ""}><Field label="What's needed"><input name="request" required className="input" /></Field></div>
      <Field label="For work item">
        <select name="work_item_id" className="input" defaultValue="">
          <option value="">—</option>
          {workItems.filter((w) => !projectId || w.project_id === projectId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </Field>
      <Field label="Needed on site by"><input name="needed_by" type="date" className="input" /></Field>
      <Field label="Quantity"><input name="quantity" type="number" step="0.01" className="input" /></Field>
      <Field label="Unit"><input name="unit" className="input" /></Field>
      <Field label="Preferred vendor"><PersonSelect name="supplier_id" people={suppliers} /></Field>
      <div className="sm:col-span-3"><Field label="Notes"><textarea name="notes" rows={2} className="input" /></Field></div>
      <div className="sm:col-span-3"><button className="btn btn-primary">Submit request</button></div>
    </form>
  );
}

export function SiteTaskForm({ projects, workItems, people, projectId, back }: {
  projects: Opt[]; workItems: (Opt & { project_id: string })[]; people: Person[]; projectId?: string; back: string;
}) {
  return (
    <form action={createSiteTask} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="back" value={back} />
      {projectId
        ? <input type="hidden" name="project_id" value={projectId} />
        : <Field label="Project"><PersonSelect name="project_id" people={projects} blank={false} /></Field>}
      <div className={projectId ? "sm:col-span-2" : ""}><Field label="Task"><input name="task" required className="input" /></Field></div>
      <Field label="Work item">
        <select name="work_item_id" className="input" defaultValue="">
          <option value="">—</option>
          {workItems.filter((w) => !projectId || w.project_id === projectId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </Field>
      <Field label="Type"><Select name="type" set="site_task_type" blank /></Field>
      <Field label="Assigned to"><PersonSelect name="assigned_to_id" people={people.filter((p) => ["management","site_ops"].includes(p.role))} /></Field>
      <Field label="Planned start"><input name="planned_start" type="date" className="input" /></Field>
      <Field label="Due"><input name="due" type="date" className="input" /></Field>
      <Field label="Priority"><Select name="priority" set="priority" defaultValue="medium" /></Field>
      <div className="sm:col-span-3"><Field label="Notes"><textarea name="notes" rows={2} className="input" /></Field></div>
      <div className="sm:col-span-3"><button className="btn btn-primary">Add task</button></div>
    </form>
  );
}
