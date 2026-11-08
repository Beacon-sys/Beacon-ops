import Link from "next/link";
import { LABELS, type LabelSet } from "@/lib/data";

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, children, action, id }: { title?: string; children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mb-6 scroll-mt-20 rounded-xl border border-line bg-surface">
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-medium">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const TONE: Record<string, string> = {
  done: "good", delivered: "good", paid: "good", active: "good", handed_over: "good",
  in_progress: "info", po_issued: "info", approved: "info", invoice_received: "info", partly_paid: "info",
  blocked: "bad", rejected: "bad", high: "bad", on_hold: "warn", awaiting_materials: "warn",
  awaiting_approval: "warn", getting_quotes: "warn", requested: "warn",
  preparations: "warn", ready_for_inspection: "info", vo: "warn", submitted: "info",
  approved_as_noted: "good", revise_resubmit: "warn", draft: "neutral",
};

export function Badge({ set, value }: { set: LabelSet; value: string | null }) {
  if (!value) return null;
  const tone = TONE[value] ?? "neutral";
  return (
    <span className={`badge badge-${tone}`}>
      {(LABELS[set] as Record<string, string>)[value] ?? value}
    </span>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            {head.map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-2 [&_td]:align-top">
          {children}
        </tbody>
      </table>
      {empty && <p className="px-4 py-6 text-center text-sm text-muted">Nothing here yet.</p>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Select({ name, set, defaultValue, required, blank }: {
  name: string; set: LabelSet; defaultValue?: string | null; required?: boolean; blank?: boolean;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} required={required} className="input">
      {blank && <option value="">—</option>}
      {Object.entries(LABELS[set]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function PersonSelect({ name, people, defaultValue, blank = true }: {
  name: string; people: { id: string; name: string }[]; defaultValue?: string | null; blank?: boolean;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} className="input">
      {blank && <option value="">—</option>}
      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

export function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="btn btn-primary">{children}</Link>;
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm">{children}</p>;
}

export function Progress({ v }: { v: number | string | null | undefined }) {
  if (v === null || v === undefined) return <span className="text-muted">—</span>;
  const p = `${Math.round(Number(v) * 100)}%`;
  return (
    <div className="flex items-center gap-2">
      <div className="bar w-20"><span style={{ width: p }} /></div>
      <span className="tabular-nums text-xs text-muted">{p}</span>
    </div>
  );
}
