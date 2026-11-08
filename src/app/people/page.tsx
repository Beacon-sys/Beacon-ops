import { redirect } from "next/navigation";
import { requireMe, LABELS, type Role } from "@/lib/data";
import { PageTitle, Card, Table, Field, Select } from "@/components/ui";
import { savePerson } from "@/app/actions";
import { ErrorNote } from "@/components/error-note";

export default async function People({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, me } = await requireMe();
  if (!["management", "procurement"].includes(me.role)) redirect("/");
  const { error } = await searchParams;
  const { data: people = [] } = await supabase.from("people").select("*").order("role").order("name");
  const mgmt = me.role === "management";

  return (
    <>
      <PageTitle title="People & companies" sub="Staff, clients, consultants and suppliers. People sign in with the email listed here." />
      <ErrorNote error={error} />
      <Card>
        <Table head={["Name", "Company", "Role", "Email", "Phone", "Login", ""]} empty={!people?.length}>
          {(people ?? []).map((p) => {
            const editable = mgmt || p.role === "supplier";
            return (
              <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                <td>{p.name}</td>
                <td>{p.company}</td>
                <td>{LABELS.role[p.role as Role]}</td>
                <td>{p.email}</td>
                <td>{p.phone}</td>
                <td className="text-muted">{p.user_id ? "Signed up" : p.email ? "Not yet" : "—"}</td>
                <td className="text-right">
                  {editable && (
                    <details className="relative inline-block text-left">
                      <summary className="btn btn-sm list-none">Edit</summary>
                      <div className="absolute right-0 z-10 mt-1 w-80 rounded-xl border border-line bg-surface p-4 shadow-lg">
                        <PersonForm person={p} mgmt={mgmt} />
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <Card title={mgmt ? "Add a person" : "Add a supplier"}><PersonForm mgmt={mgmt} /></Card>
    </>
  );
}

function PersonForm({ person, mgmt }: { person?: Record<string, string | boolean | null>; mgmt: boolean }) {
  const v = (k: string) => (person?.[k] ?? "") as string;
  return (
    <form action={savePerson} className="grid gap-3 sm:grid-cols-2">
      {person && <input type="hidden" name="id" value={v("id")} />}
      <Field label="Name"><input name="name" required defaultValue={v("name")} className="input" /></Field>
      <Field label="Company"><input name="company" defaultValue={v("company")} className="input" /></Field>
      <Field label="Email"><input name="email" type="email" defaultValue={v("email")} className="input" /></Field>
      <Field label="Phone"><input name="phone" defaultValue={v("phone")} className="input" /></Field>
      {mgmt
        ? <Field label="Role"><Select name="role" set="role" defaultValue={v("role") || "site_ops"} /></Field>
        : <input type="hidden" name="role" value="supplier" />}
      {person && (
        <Field label="Active">
          <select name="active" defaultValue={person.active ? "on" : "off"} className="input">
            <option value="on">Active</option><option value="off">Inactive</option>
          </select>
        </Field>
      )}
      <div className="sm:col-span-2"><button className="btn btn-primary">{person ? "Save" : "Add"}</button></div>
    </form>
  );
}
