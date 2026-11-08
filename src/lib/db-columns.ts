// Column definitions for the Notion-style databases (see components/database.tsx).
import type { Column } from "@/components/database";
import { LABELS, SETS_COST, SETS_PRICE, type LabelSet, type Role } from "@/lib/data";

export const opts = (set: LabelSet) =>
  Object.entries(LABELS[set] as Record<string, string>).map(([value, label]) => ({ value, label }));
const rel = (list: { id: string; name: string }[]) => list.map((x) => ({ value: x.id, label: x.name }));

export function workItemColumns(role: Role, showCost: boolean): Column[] {
  return [
    { key: "boq_ref", label: "BOQ No.", type: "text", editable: true, width: 90 },
    { key: "name", label: "Item description", type: "text", editable: true, width: 260 },
    { key: "item_type", label: "Type", type: "select", options: opts("item_type"), editable: true },
    { key: "category", label: "Category", type: "text", editable: true },
    { key: "trade", label: "Trade", type: "select", options: opts("trade"), editable: true, hidden: true },
    { key: "quantity", label: "Qty", type: "number", editable: true },
    { key: "unit", label: "Unit", type: "text", editable: true, width: 70 },
    ...(showCost ? [
      { key: "cost_rate", label: "Cost rate", type: "money", editable: SETS_COST.includes(role) },
      { key: "cost", label: "Cost", type: "money", sum: true },
    ] as Column[] : []),
    { key: "beacon_rate", label: "Beacon rate", type: "money", editable: SETS_PRICE.includes(role) },
    { key: "price", label: "Beacon price", type: "money", sum: true },
    { key: "status", label: "Status", type: "select", options: opts("work_item_status"), editable: true },
    { key: "progress", label: "Progress", type: "progress", editable: true },
    { key: "planned_start", label: "Planned start", type: "date", editable: true },
    { key: "planned_finish", label: "Planned finish", type: "date", editable: true },
    { key: "actual_start", label: "Actual start", type: "date", editable: true, hidden: true },
    { key: "actual_finish", label: "Actual finish", type: "date", editable: true, hidden: true },
    { key: "visible_to_client", label: "Client sees", type: "checkbox", editable: true, hidden: true },
    { key: "notes", label: "Notes", type: "longtext", editable: true, hidden: true },
  ];
}

export function taskColumns(people: { id: string; name: string }[], workItems: { id: string; name: string }[], withProject = false): Column[] {
  return [
    { key: "task", label: "Task", type: "text", editable: true, width: 260 },
    ...(withProject ? [{ key: "project_name", label: "Project", type: "text" } as Column] : []),
    { key: "type", label: "Type", type: "select", options: opts("site_task_type"), editable: true },
    { key: "status", label: "Status", type: "select", options: opts("site_task_status"), editable: true },
    { key: "priority", label: "Priority", type: "select", options: opts("priority"), editable: true },
    { key: "assigned_to_id", label: "Assigned to", type: "relation", options: rel(people), display: "assignee_name", editable: true },
    { key: "work_item_id", label: "Work item", type: "relation", options: rel(workItems), display: "work_item_name", editable: !withProject },
    { key: "planned_start", label: "Planned start", type: "date", editable: true, hidden: true },
    { key: "due", label: "Due", type: "date", editable: true },
    { key: "done_on", label: "Done on", type: "date", hidden: true },
    { key: "notes", label: "Notes", type: "longtext", editable: true, hidden: true },
  ];
}

export function purchaseColumns(role: Role, suppliers: { id: string; name: string }[], workItems: { id: string; name: string }[]): Column[] {
  const buyer = role === "management" || role === "procurement";
  const payer = role === "management" || role === "accountant";
  return [
    { key: "request", label: "Request", type: "text", editable: buyer, width: 240 },
    { key: "work_item_id", label: "Work item", type: "relation", options: rel(workItems), display: "work_item_name", editable: buyer },
    { key: "quantity", label: "Qty", type: "number", editable: buyer },
    { key: "unit", label: "Unit", type: "text", editable: buyer, width: 70 },
    { key: "needed_by", label: "Needed by", type: "date", editable: buyer },
    { key: "supplier_id", label: "Supplier", type: "relation", options: rel(suppliers), display: "supplier_name", editable: buyer },
    { key: "status", label: "Status", type: "select", options: opts("purchase_status"), editable: buyer },
    { key: "po_number", label: "PO No.", type: "text", editable: buyer, hidden: true },
    { key: "amount", label: "Amount", type: "money", editable: buyer, sum: true },
    { key: "payment_status", label: "Payment", type: "select", options: opts("payment_status"), editable: payer },
    { key: "invoice_no", label: "Invoice No.", type: "text", editable: payer, hidden: true },
    { key: "notes", label: "Notes", type: "longtext", editable: buyer || payer, hidden: true },
  ];
}

export function submittalColumns(withProject: boolean): Column[] {
  return [
    { key: "number", label: "No.", type: "text", editable: true, width: 90 },
    { key: "title", label: "Title", type: "text", editable: true, width: 260 },
    ...(withProject ? [{ key: "project_name", label: "Project", type: "text" } as Column] : []),
    { key: "work_items_text", label: "Work items", type: "text" },
    { key: "kind", label: "Type", type: "select", options: opts("submittal_kind"), editable: true },
    { key: "revision", label: "Rev", type: "number", editable: true, width: 60 },
    { key: "status", label: "Status", type: "select", options: opts("submittal_status"), editable: true },
    { key: "submitted_on", label: "Submitted", type: "date", editable: true },
    { key: "due_back", label: "Due back", type: "date", editable: true },
    { key: "returned_on", label: "Returned", type: "date", editable: true },
    { key: "link", label: "File", type: "url", editable: true },
    { key: "notes", label: "Notes", type: "longtext", editable: true, hidden: true },
  ];
}
