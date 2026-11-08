import Link from "next/link";
import { money, date } from "@/lib/data";
import { Badge, Progress } from "@/components/ui";

export type WorkItemRow = {
  id: string; boq_ref: string | null; item_type: string; name: string; category: string | null; trade: string | null;
  quantity: number | null; unit: string | null; cost_rate: number | null; cost: number | null;
  beacon_rate: number | null; price: number | null; status: string; progress: number;
  planned_start: string | null; planned_finish: string | null; visible_to_client: boolean;
  submittal_count?: number; attachment_count?: number; open_site_tasks?: number;
};

const num = (n: number | null) => (n === null || n === undefined ? "" : Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 }));

/** BOQ-style table grouped by category, with cost and price totals. */
export function WorkItemsTable({ items, showCost, internal }: { items: WorkItemRow[]; showCost: boolean; internal: boolean }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">No work items yet.</p>;
  const groups = new Map<string, WorkItemRow[]>();
  for (const w of items) {
    const k = w.category || "Uncategorised";
    groups.set(k, [...(groups.get(k) ?? []), w]);
  }
  const total = (rows: WorkItemRow[], k: "cost" | "price") => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const cols = 9 + (showCost ? 2 : 0);

  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
            <th className="pl-4">BOQ No.</th><th>Item description</th><th>Trade</th>
            <th className="text-right">Qty</th><th>Unit</th>
            {showCost && <><th className="text-right">Cost rate</th><th className="text-right">Cost</th></>}
            <th className="text-right">Beacon rate</th><th className="text-right">Price</th>
            <th>Status</th><th className="pr-4">Planned</th>
          </tr>
        </thead>
        <tbody>
          {[...groups.entries()].map(([cat, rows]) => (
            <Group key={cat} cat={cat} rows={rows} showCost={showCost} internal={internal} cols={cols}
              cost={total(rows, "cost")} price={total(rows, "price")} />
          ))}
          <tr className="border-t-2 border-line font-semibold [&>td]:px-3 [&>td]:py-2">
            <td className="pl-4" colSpan={5}>Total</td>
            {showCost && <><td /><td className="text-right tabular-nums">{money(total(items, "cost"))}</td></>}
            <td /><td className="text-right tabular-nums">{money(total(items, "price"))}</td>
            <td colSpan={2} className="pr-4 text-xs font-normal text-muted">
              {showCost && total(items, "price") > 0 && `Margin ${money(total(items, "price") - total(items, "cost"))} (${Math.round((1 - total(items, "cost") / total(items, "price")) * 100)}%)`}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Group({ cat, rows, showCost, internal, cols, cost, price }: {
  cat: string; rows: WorkItemRow[]; showCost: boolean; internal: boolean; cols: number; cost: number; price: number;
}) {
  return (
    <>
      <tr className="bg-[var(--neutral-bg)]/60">
        <td colSpan={cols} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide">
          {cat}
          <span className="ml-3 font-normal normal-case tracking-normal text-muted">
            {rows.length} items{showCost ? ` · cost ${money(cost)}` : ""} · price {money(price)}
          </span>
        </td>
      </tr>
      {rows.map((w) => (
        <tr key={w.id} className="border-b border-line align-top [&>td]:px-3 [&>td]:py-2">
          <td className="whitespace-nowrap pl-4">
            {w.boq_ref ?? "—"}
            {w.item_type === "vo" && <span className="badge badge-warn ml-1.5">VO</span>}
          </td>
          <td className="min-w-[280px] max-w-[380px]">
            <Link className="link" href={`/work-items/${w.id}`}>{w.name}</Link>
            {internal && (
              <div className="mt-0.5 text-xs text-muted">
                {[!w.visible_to_client && "Hidden from client", w.submittal_count ? `${w.submittal_count} submittals` : null,
                  w.attachment_count ? `${w.attachment_count} files` : null, w.open_site_tasks ? `${w.open_site_tasks} open tasks` : null]
                  .filter(Boolean).join(" · ")}
              </div>
            )}
          </td>
          <td><Badge set="trade" value={w.trade} /></td>
          <td className="text-right tabular-nums">{num(w.quantity)}</td>
          <td>{w.unit}</td>
          {showCost && <><td className="text-right tabular-nums">{num(w.cost_rate)}</td><td className="text-right tabular-nums">{money(w.cost)}</td></>}
          <td className="text-right tabular-nums">{num(w.beacon_rate)}</td>
          <td className="text-right tabular-nums">{money(w.price)}</td>
          <td>
            <Badge set="work_item_status" value={w.status} />
            <div className="mt-1"><Progress v={w.progress} /></div>
          </td>
          <td className="whitespace-nowrap pr-4 text-xs">{date(w.planned_start)}<br />{date(w.planned_finish)}</td>
        </tr>
      ))}
    </>
  );
}
