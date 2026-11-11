import Link from "next/link";
import { getLang } from "@/lib/i18n/server";
import { localeOf, makeT } from "@/lib/i18n";
import { translateToArabic } from "@/lib/translate";
import { T } from "@/components/i18n";
import { notFound } from "next/navigation";
import { requireMe, isInternal, money, date, label, SEES_COST, SETS_COST, SETS_PRICE, EDITS_WORK } from "@/lib/data";
import { PageTitle, Card, Stat, Table, Badge, Progress, Field, Select } from "@/components/ui";
import { WorkItemForm } from "@/components/forms";
import { TaskTable, TASK_SELECT, type TaskRow } from "@/components/task-table";
import { PurchaseTable, PURCHASE_SELECT, type PurchaseRow } from "@/components/purchase-table";
import { ErrorNote } from "@/components/error-note";
import { addAttachmentLink, deleteAttachment, linkSubmittal, saveSubmittal, saveCostRate } from "@/app/actions";


export default async function WorkItemPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, me } = await requireMe();
  const internal = isInternal(me.role);
  const back = `/work-items/${id}`;
  const lang = await getLang();
  const t = makeT(lang);
  const num = (n: number | null) => (n === null || n === undefined ? "—" : Number(n).toLocaleString(localeOf(lang), { maximumFractionDigits: 2 }));

  const { data: w } = await supabase.from("work_item_summary").select("*").eq("id", id).maybeSingle();
  if (!w) notFound();
  const { data: project } = await supabase.from("projects").select("id,name,status").eq("id", w.project_id).maybeSingle();

  const [team, links, files, tasks, purchases, people, cats, projectSubs] = await Promise.all([
    internal ? supabase.from("work_item_people").select("person:people(id,name,role,phone)").eq("work_item_id", id) : Promise.resolve({ data: [] }),
    supabase.from("work_item_submittals").select("submittal:submittals(*)").eq("work_item_id", id),
    supabase.from("attachments").select("*").eq("work_item_id", id).order("created_at", { ascending: false }),
    internal ? supabase.from("site_tasks").select(TASK_SELECT).eq("work_item_id", id).order("due", { nullsFirst: false }) : Promise.resolve({ data: [] }),
    internal ? supabase.from("purchases").select(PURCHASE_SELECT).eq("work_item_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    internal ? supabase.from("people").select("id,name,role").eq("active", true).order("name") : Promise.resolve({ data: [] }),
    supabase.from("work_items").select("category").eq("project_id", w.project_id).not("category", "is", null),
    internal ? supabase.from("submittals").select("id,number,title").eq("project_id", w.project_id).order("number") : Promise.resolve({ data: [] }),
  ]);
  type Person = { id: string; name: string; role: string; phone: string | null };
  type Sub = { id: string; number: string | null; title: string; kind: string; revision: number; status: string; submitted_on: string | null; returned_on: string | null; link: string | null };
  const teamList = ((team.data ?? []) as unknown as { person: Person }[]).map((t) => t.person).filter(Boolean);
  const subs = ((links.data ?? []) as unknown as { submittal: Sub }[]).map((l) => l.submittal).filter(Boolean);
  const everyone = (people.data ?? []) as { id: string; name: string; role: string }[];
  const vendors = everyone.filter((p) => p.role === "supplier" || p.role === "contractor");
  const categories = [...new Set(((cats.data ?? []) as { category: string }[]).map((c) => c.category))];
  const unlinked = ((projectSubs.data ?? []) as { id: string; number: string | null; title: string }[]).filter((s) => !subs.some((x) => x.id === s.id));

  const tenderOpen = me.role === "tendering" && project?.status === "tendering";
  const canEdit = EDITS_WORK.includes(me.role) && (me.role !== "tendering" || tenderOpen);
  const canCost = SETS_COST.includes(me.role) && (me.role !== "tendering" || tenderOpen);
  const showCost = SEES_COST.includes(me.role);
  const canDocs = internal && me.role !== "accountant";
  // Arabic: the item's own text translated by Claude (cached); the form below still edits the original.
  const ar = lang === "ar" ? await translateToArabic(supabase, [w.name, w.category, w.notes, w.area, ...subs.map((s) => s.title),
    ...((tasks.data ?? []) as unknown as { task: string }[]).map((x) => x.task), ...((purchases.data ?? []) as unknown as { request: string }[]).map((x) => x.request)]) : {};
  const tr = (s: string | null | undefined) => (s ? ar[s] ?? s : s);

  return (
    <>
      <div className="mb-2 text-sm"><Link className="link" href={`/projects/${w.project_id}`}>← {project?.name}</Link></div>
      <PageTitle
        title={`${w.boq_ref ? w.boq_ref + " · " : ""}${tr(w.name)}`}
        sub={[t(label("item_type", w.item_type)), tr(w.category), w.trade && t(label("trade", w.trade)), tr(w.area)].filter(Boolean).join(" · ")}
        action={<Badge set="work_item_status" value={w.status} />}
      />
      <ErrorNote error={error} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Quantity" value={<>{num(w.quantity)} <span className="text-base text-muted">{w.unit}</span></>} />
        <Stat label="Beacon's rate / price" value={<span className="text-base">{num(w.beacon_rate)} <span className="text-muted">/ {money(w.price) || "—"}</span></span>} />
        {showCost
          ? <Stat label="Cost rate / cost" value={<span className="text-base">{num(w.cost_rate)} <span className="text-muted">/ {money(w.cost) || "—"}</span></span>} />
          : <Stat label="Progress" value={<Progress v={w.progress} />} />}
        {showCost
          ? <Stat label="Margin" value={w.price && w.cost !== null ? `${money(w.price - w.cost)} (${Math.round((1 - w.cost / w.price) * 100)}%)` : "—"} />
          : <Stat label="Planned finish" value={date(w.planned_finish) || "—"} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Schedule">
            <Table head={["", "Start", "Finish"]}>
              <tr><td className="text-muted"><T>{"Planned"}</T></td><td>{date(w.planned_start) || "—"}</td><td>{date(w.planned_finish) || "—"}</td></tr>
              <tr><td className="text-muted"><T>{"Actual"}</T></td><td>{date(w.actual_start) || "—"}</td><td>{date(w.actual_finish) || "—"}</td></tr>
            </Table>
            <div className="mt-3 flex items-center gap-3 text-sm"><span className="text-muted"><T>{"Progress"}</T></span><Progress v={w.progress} />
              <Link className="link ms-auto" href={`/projects/${w.project_id}/timeline`}><T>{"View on timeline"}</T></Link></div>
          </Card>

          <Card title={`${t("Submittals")} (${subs.length})`} action={<Link className="link text-sm" href={`/submittals?project=${w.project_id}`}><T>{"Register"}</T></Link>}>
            <Table head={["No.", "Title", "Type", "Rev", "Status", "Submitted", "Returned", ""]} empty={!subs.length}>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap">{s.number}</td>
                  <td>{s.link ? <a className="link" href={s.link} target="_blank" rel="noreferrer">{tr(s.title)}</a> : tr(s.title)}</td>
                  <td>{t(label("submittal_kind", s.kind))}</td>
                  <td>{s.revision}</td>
                  <td><Badge set="submittal_status" value={s.status} /></td>
                  <td>{date(s.submitted_on)}</td>
                  <td>{date(s.returned_on)}</td>
                  <td className="text-end">
                    {canDocs && (
                      <form action={linkSubmittal}>
                        <input type="hidden" name="back" value={back} /><input type="hidden" name="work_item_id" value={id} />
                        <input type="hidden" name="submittal_id" value={s.id} /><input type="hidden" name="unlink" value="1" />
                        <button className="btn btn-sm"><T>{"Unlink"}</T></button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
            {canDocs && (
              <div className="mt-4 flex flex-wrap gap-2">
                {unlinked.length > 0 && (
                  <form action={linkSubmittal} className="flex gap-2">
                    <input type="hidden" name="back" value={back} /><input type="hidden" name="work_item_id" value={id} />
                    <select name="submittal_id" className="input w-64">
                      {unlinked.map((s) => <option key={s.id} value={s.id}>{[s.number, s.title].filter(Boolean).join(" – ")}</option>)}
                    </select>
                    <button className="btn btn-sm"><T>{"Link existing"}</T></button>
                  </form>
                )}
                <details className="w-full">
                  <summary className="btn btn-sm list-none"><T>{"+ New submittal"}</T></summary>
                  <form action={saveSubmittal} className="mt-3 grid gap-3 sm:grid-cols-3">
                    <input type="hidden" name="back" value={back} /><input type="hidden" name="project_id" value={w.project_id} />
                    <input type="hidden" name="work_item_id" value={id} />
                    <Field label="Number"><input name="number" placeholder="SUB-001" className="input" /></Field>
                    <div className="sm:col-span-2"><Field label="Title"><input name="title" required className="input" /></Field></div>
                    <Field label="Type"><Select name="kind" set="submittal_kind" defaultValue="material" /></Field>
                    <Field label="Status"><Select name="status" set="submittal_status" defaultValue="draft" /></Field>
                    <Field label="Revision"><input name="revision" type="number" min={0} defaultValue={0} className="input" /></Field>
                    <Field label="Submitted on"><input name="submitted_on" type="date" className="input" /></Field>
                    <Field label="Response due"><input name="due_back" type="date" className="input" /></Field>
                    <Field label="Document link"><input name="link" type="url" placeholder="https://drive.google.com/…" className="input" /></Field>
                    <div className="sm:col-span-3"><button className="btn btn-primary"><T>{"Add submittal"}</T></button></div>
                  </form>
                </details>
              </div>
            )}
          </Card>

          <Card title={`${t("Attachments")} (${files.data?.length ?? 0})`}>
            <Table head={["Document", "Type", "Added", ""]} empty={!files.data?.length}>
              {(files.data ?? []).map((f) => (
                <tr key={f.id}>
                  <td>
                    {f.url ? <a className="link" href={f.url} target="_blank" rel="noreferrer">{f.file_name}</a> : f.file_name}
                    {internal && f.visible_to_client && <span className="ms-2 text-xs text-muted"><T>{"Client can see"}</T></span>}
                  </td>
                  <td className="capitalize">{t(f.kind[0].toUpperCase() + f.kind.slice(1))}</td>
                  <td>{date(f.created_at?.slice(0, 10))}</td>
                  <td className="text-end">
                    {canDocs && (
                      <form action={deleteAttachment}>
                        <input type="hidden" name="back" value={back} /><input type="hidden" name="id" value={f.id} />
                        <button className="btn btn-sm"><T>{"Remove"}</T></button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
            {canDocs && (
              <form action={addAttachmentLink} className="mt-4 grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="back" value={back} /><input type="hidden" name="project_id" value={w.project_id} />
                <input type="hidden" name="work_item_id" value={id} />
                <Field label="Name"><input name="file_name" placeholder={t("e.g. Shop drawing rev B")} className="input" /></Field>
                <div className="sm:col-span-2"><Field label="Link (Google Drive etc.)"><input name="url" required placeholder="https://drive.google.com/…" className="input" /></Field></div>
                <Field label="Type">
                  <select name="kind" className="input" defaultValue="drawing">
                    {["drawing", "photo", "quotation", "invoice", "contract", "report", "other"].map((k) => <option key={k} value={k}>{t(k[0].toUpperCase() + k.slice(1))}</option>)}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="visible_to_client" /><T>{"Client can see"}</T></label>
                <div className="sm:col-span-3"><button className="btn btn-sm btn-primary"><T>{"Add link"}</T></button></div>
              </form>
            )}
          </Card>

          {internal && (
            <>
              <Card title="Site tasks"><TaskTable rows={((tasks.data ?? []) as unknown as TaskRow[]).map((x) => ({ ...x, task: tr(x.task)! }))} canEdit={canEdit} back={back} showProject={false} /></Card>
              <Card title="Purchases"><PurchaseTable rows={((purchases.data ?? []) as unknown as PurchaseRow[]).map((x) => ({ ...x, request: tr(x.request)! }))} role={me.role} suppliers={vendors} back={back} showProject={false} /></Card>
            </>
          )}
        </div>

        <div>
          {internal && (
            <Card title="Team">
              {teamList.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {teamList.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span>{p.name}<span className="ms-2 text-xs text-muted">{t(label("role", p.role))}</span></span>
                      {p.phone && <a className="link text-xs" href={`tel:${p.phone}`}>{p.phone}</a>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted"><T>{"No one assigned yet."}</T></p>}
            </Card>
          )}
          {canCost && !canEdit && (
            <Card title="Cost rate">
              <form action={saveCostRate} className="grid gap-3">
                <input type="hidden" name="back" value={back} /><input type="hidden" name="work_item_id" value={id} />
                <Field label="Cost rate (EGP)"><input name="cost_rate" type="number" step="0.01" defaultValue={w.cost_rate ?? ""} className="input" /></Field>
                <Field label="From vendor / contract">
                  <select name="cost_vendor_id" defaultValue={w.cost_vendor_id ?? ""} className="input">
                    <option value="">—</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </Field>
                <button className="btn btn-sm btn-primary justify-center"><T>{"Save cost rate"}</T></button>
              </form>
            </Card>
          )}
          {internal && w.contract_id && (
            <Card title="Contract">
              <Link className="link text-sm" href={`/procurement/contracts/${w.contract_id}`}><T>{"Open contract"}</T></Link>
              <p className="mt-1 text-xs text-muted"><T>{"The cost rate comes from this contract."}</T></p>
            </Card>
          )}
          {w.notes && <Card title="Notes"><p className="whitespace-pre-wrap text-sm">{tr(w.notes)}</p></Card>}
        </div>
      </div>

      {canEdit && (
        <Card title="Edit work item">
          <WorkItemForm projectId={w.project_id} item={w} people={everyone} categories={categories} vendors={vendors}
            team={teamList.map((p) => p.id)} canCost={canCost} canPrice={SETS_PRICE.includes(me.role) && (me.role !== "tendering" || tenderOpen)} back={back} />
        </Card>
      )}
    </>
  );
}
