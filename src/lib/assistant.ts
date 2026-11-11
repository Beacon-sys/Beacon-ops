import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLAUDE_MODEL, getClaude } from "@/lib/claude";
import { INTERNAL, LABELS, type Me } from "@/lib/data";

type Msg = Anthropic.Beta.BetaMessageParam;

export type ChatTurn = { role: "user" | "assistant"; text: string };

// Tables and views the assistant may read. Every query runs as the signed-in person,
// so Supabase row-level security decides which rows they see, exactly as in the app.
const INTERNAL_TABLES = [
  "projects", "project_summary", "project_members", "people", "work_items", "work_item_summary",
  "work_item_people", "work_item_dependencies", "milestones", "site_tasks", "meetings",
  "purchases", "purchases_view", "vendor_summary", "contracts", "contract_summary", "contract_items",
  "submittals", "work_item_submittals", "attachments",
] as const;
// Clients and consultants: only tables they already see in their portal.
const EXTERNAL_TABLES = ["projects", "work_items", "milestones", "submittals", "site_tasks", "attachments"] as const;

const SCHEMA = `
Database (Postgres via Supabase; ids are uuids; money in EGP unless projects.currency says otherwise):
- projects: id, name, code, client_id, consultant_id, project_manager_id (-> people), location, status (${Object.keys(LABELS.project_status).join("/")}), start_date, planned_finish, contract_value, currency
- project_summary (view): projects.* + work_item_count, avg_progress, committed_spend, open_purchases, paid_to_date
- people: id, name, email, phone, company, role (management/tendering/site_ops/procurement/accountant/client/consultant/supplier/contractor), active
- project_members: project_id, person_id
- work_items (BOQ lines and variation orders): id, project_id, name, boq_ref, item_type (boq/vo), category, trade (${Object.keys(LABELS.trade).join("/")}), area, status (${Object.keys(LABELS.work_item_status).join("/")}), progress (0-100), responsible_id, planned_start, planned_finish, actual_start, actual_finish, quantity, unit, beacon_rate (client price per unit), budget, visible_to_client, notes
- work_item_summary (view, internal): work_items.* + cost_rate, cost_vendor_id, contract_id, cost, price, committed_spend, open_site_tasks, submittal_count, attachment_count
- work_item_people: work_item_id, person_id; work_item_dependencies: predecessor_id, successor_id, kind (FS/SS/FF/SF), lag_days
- milestones: id, project_id, name, planned_date, actual_date, visible_to_client
- site_tasks: id, project_id, work_item_id, meeting_id, task, type (${Object.keys(LABELS.site_task_type).join("/")}), party (beacon/client/consultant/contractor), assigned_to_id, planned_start, started_on, due, priority (high/medium/low), status (to_do/in_progress/blocked/done), done_on, notes
- meetings: id, project_id, title, meeting_date, kind, location, attendees, notes
- purchases: id, project_id, work_item_id, request, requested_by_id, date_requested, needed_by, quantity, unit, supplier_id (-> people), po_number, amount, status (${Object.keys(LABELS.purchase_status).join("/")}), procurement_owner_id, payment_status (${Object.keys(LABELS.payment_status).join("/")}), invoice_no, delivered_on, paid_on, notes
- purchases_view (view): purchases.* + days_until_needed
- vendor_summary (view): id (-> people), orders, ordered_value, paid_value, last_order
- contracts: id, project_id, vendor_id, number, title, status (${Object.keys(LABELS.contract_status).join("/")}), start_date, finish_date, retention_pct, link, notes
- contract_summary (view): contracts.* + item_count, contract_value, progress; contract_items: contract_id, work_item_id, rate, quantity, start_date, finish_date
- submittals: id, project_id, number, title, kind (${Object.keys(LABELS.submittal_kind).join("/")}), revision, status (${Object.keys(LABELS.submittal_status).join("/")}), submitted_on, due_back, returned_on, link, notes; work_item_submittals: work_item_id, submittal_id
- attachments: id, project_id, work_item_id, purchase_id, site_task_id, kind, file_name, url, visible_to_client
Related rows can be embedded in "select" with PostgREST syntax, e.g. "name,status,client:client_id(name)" or "task,due,project:project_id(name),assignee:assigned_to_id(name)".
App pages you can link to: /projects/<id>, /projects/<id>/work-items, /projects/<id>/tasks, /projects/<id>/purchasing, /projects/<id>/timeline, /projects/<id>/meetings, /work-items/<id>, /procurement/contracts/<id>, /procurement/vendors/<id>, /submittals?project=<id>.`;

function systemPrompt(me: Me, internal: boolean) {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the assistant built into Beacon Operations, the internal app of Beacon, a construction contractor in Egypt. You answer questions about Beacon's projects, BOQ work items, site tasks, meetings, purchasing, contracts and submittals by reading the database with the query_records tool.

You are talking to ${me.name}, whose role is ${LABELS.role[me.role]}${internal ? "" : ` (an external ${me.role}: they only see their own projects and client-visible information)`}. Today is ${today}.

Rules:
- You can only read data. You cannot create, change or delete anything; if asked, say so and point to the page where the person can do it.
- Only state facts you got from the tool. If a query returns nothing, the record may not exist or this person may not have access to it; say that plainly rather than guessing.
- Never reveal information to this person that the tool did not return to them.
- Prefer small, targeted queries (select only the columns you need, filter, and use count_only for counts). Look up ids by name with an ilike filter when the person names a project, person or item.
- Answer in the language the person writes in (Arabic or English). Be concise: lead with the answer, then a short list or table if helpful. Use the human-readable labels for statuses (e.g. "In progress", not "in_progress"). Format money with thousands separators and the currency.
- When you mention a specific project, work item, contract or vendor, link to its page with a Markdown link such as [Villa 12](/projects/<id>).
${SCHEMA}`;
}

const filterOps = ["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "is", "in"] as const;

function queryTool(tables: readonly string[]): Anthropic.Beta.BetaTool {
  return {
    name: "query_records",
    description:
      "Read rows from one table or view of the Beacon database, as the signed-in person (row-level security applies). " +
      "Returns JSON rows, or a count when count_only is true. Errors are returned as text so you can fix the query and retry.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", enum: [...tables] },
        select: { type: "string", description: 'Columns to return, PostgREST syntax. Default "*".' },
        filters: {
          type: "array",
          description: "All filters are combined with AND.",
          items: {
            type: "object",
            properties: {
              column: { type: "string" },
              op: { type: "string", enum: [...filterOps] },
              value: {
                type: "string",
                description: 'ilike: text to search (wrapped in % automatically unless it contains %). in: comma-separated values. is: "null", "true" or "false". Dates as YYYY-MM-DD.',
              },
            },
            required: ["column", "op", "value"],
          },
        },
        order_by: { type: "string", description: 'Column to sort by; prefix with "-" for descending.' },
        limit: { type: "integer", description: "Max rows, 1-200. Default 50." },
        count_only: { type: "boolean", description: "Return only the number of matching rows." },
      },
      required: ["table"],
    },
  };
}

type QueryInput = {
  table?: string; select?: string; order_by?: string; limit?: number; count_only?: boolean;
  filters?: { column?: string; op?: string; value?: string }[];
};

const IDENT = /^[a-z_][a-z0-9_]*$/;

async function runQuery(supabase: SupabaseClient, tables: readonly string[], input: QueryInput) {
  const { table, filters = [], order_by, count_only } = input;
  if (!table || !tables.includes(table)) return { error: `Unknown or unavailable table: ${table}` };
  const select = (input.select ?? "*").trim() || "*";
  if (!/^[\w\s,:*().!-]+$/.test(select)) return { error: "Invalid select string" };
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 200);

  let q = count_only
    ? supabase.from(table).select(select, { count: "exact", head: true })
    : supabase.from(table).select(select);
  for (const f of filters) {
    if (!f.column || !IDENT.test(f.column) || !filterOps.includes(f.op as (typeof filterOps)[number])) {
      return { error: `Invalid filter: ${JSON.stringify(f)}` };
    }
    const v = String(f.value ?? "");
    if (f.op === "ilike") q = q.ilike(f.column, v.includes("%") ? v : `%${v}%`);
    else if (f.op === "in") q = q.in(f.column, v.split(",").map((s) => s.trim()).filter(Boolean));
    else if (f.op === "is") q = q.is(f.column, v === "null" ? null : v === "true");
    else q = q.filter(f.column, f.op as string, v);
  }
  if (order_by) {
    const col = order_by.replace(/^-/, "");
    if (!IDENT.test(col)) return { error: "Invalid order_by" };
    q = q.order(col, { ascending: !order_by.startsWith("-"), nullsFirst: false });
  }
  if (!count_only) q = q.limit(limit);

  const { data, count, error } = await q;
  if (error) return { error: error.message };
  return count_only ? { count } : { rows: data, returned: data?.length ?? 0, limit };
}

const MAX_TOOL_ROUNDS = 10;

// Answers one question. Earlier turns are sent as plain text (no earlier thinking or
// tool calls), so the history only ever grows by appending within a request.
export async function askAssistant(
  supabase: SupabaseClient, me: Me, history: ChatTurn[], question: string, page?: string,
) {
  const internal = INTERNAL.includes(me.role);
  const tables = internal ? INTERNAL_TABLES : EXTERNAL_TABLES;
  const tools = [queryTool(tables)];
  const system = systemPrompt(me, internal);
  const messages: Msg[] = [
    ...history.map((t) => ({ role: t.role, content: t.text })),
    { role: "user", content: page ? `(I'm on the page ${page})\n\n${question}` : question },
  ];

  const claude = getClaude();
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await claude.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      system,
      tools,
      messages,
      output_config: { effort: "medium" },
      // Caches the growing conversation so each tool round only pays full price for new tokens.
      cache_control: { type: "ephemeral" },
      // If a safety classifier declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (res.stop_reason === "refusal") {
      return "Sorry, I can't help with that request.";
    }
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text).join("\n").trim();
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || calls.length === 0) {
      return text || "I couldn't find an answer to that.";
    }
    if (round === MAX_TOOL_ROUNDS) break;

    messages.push({ role: "assistant", content: res.content });
    const results = await Promise.all(calls.map(async (c): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
      try {
        const out = await runQuery(supabase, tables, c.input as QueryInput);
        let json = JSON.stringify(out);
        if (json.length > 60000) json = json.slice(0, 60000) + "... [truncated: narrow the query]";
        return { type: "tool_result", tool_use_id: c.id, content: json, is_error: "error" in out };
      } catch (e) {
        return { type: "tool_result", tool_use_id: c.id, content: String(e), is_error: true };
      }
    }));
    messages.push({ role: "user", content: results });
  }
  return "That question needed more lookups than I'm allowed in one go. Try asking something narrower.";
}
