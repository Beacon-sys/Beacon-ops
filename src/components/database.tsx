"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateField, createRow, deleteRow, bulkUpdate, saveCustomField, deleteCustomField, moveCustomField } from "@/app/db-actions";

export type ColType = "text" | "longtext" | "number" | "money" | "date" | "select" | "relation" | "checkbox" | "progress" | "url";
export type Column = {
  key: string; label: string; type: ColType;
  options?: { value: string; label: string; tone?: string }[];   // select + relation
  editable?: boolean; width?: number; sum?: boolean; hidden?: boolean;
  display?: string;   // for relations: key holding the display text
  custom?: { id: string; options: string[]; client_visible: boolean };   // management-defined column
};
export type Row = Record<string, unknown> & { id: string };
export type ViewKind = "table" | "board" | "calendar" | "list";

type Filter = { key: string; op: "is" | "not" | "contains" | "empty" | "notempty" | "before" | "after"; value: string };
type Settings = {
  view: ViewKind; search: string; filters: Filter[]; sort: { key: string; dir: "asc" | "desc" } | null;
  group: string | null; boardBy: string | null; dateBy: string | null; hidden: string[]; month: string;
  widths: Record<string, number>;
};

const TONES: Record<string, string> = {
  done: "good", delivered: "good", paid: "good", approved: "good", approved_as_noted: "good", completed: "good", signed: "info",
  in_progress: "info", po_issued: "info", invoice_received: "info", submitted: "info", ready_for_inspection: "info",
  blocked: "bad", rejected: "bad", high: "bad", terminated: "bad", revise_resubmit: "warn", preparations: "warn",
  requested: "warn", getting_quotes: "warn", partly_paid: "info", vo: "warn",
};
const FIELD_TYPE_LABEL: Record<string, string> = {
  text: "Text", longtext: "Long text", number: "Number", money: "Money (EGP)", date: "Date", select: "Choice list", checkbox: "Checkbox", url: "Link",
};
const egp = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });
const fmtDate = (d: string) => new Date(d.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

export function Database({ id, table, columns, rows, titleKey, href, editable, creatable = editable, createDefaults, views = ["table", "board", "calendar", "list"], initial, fieldsTable, canManageFields = false, fullPage = false }: {
  id: string;                     // unique key to remember view settings
  table: string; columns: Column[]; rows: Row[]; titleKey: string;
  href?: string;                  // row page, with :id placeholder
  editable: boolean; creatable?: boolean; createDefaults?: Record<string, string | number | boolean | null>;
  views?: ViewKind[]; initial?: Partial<Settings>;
  fieldsTable?: string; canManageFields?: boolean;   // management may add columns
  fullPage?: boolean;   // own page: taller grid with a sticky header
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, Record<string, unknown>>>({});
  const [editing, setEditing] = useState<{ row: string; key: string; seed?: string } | null>(null);
  const [sel, setSel] = useState<{ row: string; key: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newTitle, setNewTitle] = useState("");
  const [fieldForm, setFieldForm] = useState<{ id?: string; label: string; type: string; options: string; client_visible: boolean } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<"filter" | "sort" | "group" | "fields" | null>(null);
  const firstSelect = columns.find((c) => c.type === "select")?.key ?? null;
  const firstDate = columns.find((c) => c.type === "date")?.key ?? null;
  const [s, setS] = useState<Settings>({
    view: "table", search: "", filters: [], sort: null, group: null, boardBy: firstSelect, dateBy: firstDate,
    hidden: columns.filter((c) => c.hidden).map((c) => c.key), month: new Date().toISOString().slice(0, 7), widths: {}, ...initial,
  });

  // Remember each person's view settings per database.
  useEffect(() => {
    try { const saved = localStorage.getItem(`db:${id}`); if (saved) setS((x) => ({ ...x, ...JSON.parse(saved) })); } catch {}
  }, [id]);
  useEffect(() => { try { localStorage.setItem(`db:${id}`, JSON.stringify({ ...s, search: "" })); } catch {} }, [id, s]);

  const col = (k: string) => columns.find((c) => c.key === k);
  const val = (r: Row, k: string) => (local[r.id] && k in local[r.id] ? local[r.id][k] : r[k]);
  const text = (r: Row, c: Column): string => {
    const v = val(r, c.key);
    if (v === null || v === undefined || v === "") return "";
    if (c.type === "select" || c.type === "relation") return c.options?.find((o) => o.value === v)?.label ?? (c.display ? String(r[c.display] ?? "") : String(v));
    return String(v);
  };

  const save = (r: Row, c: Column, value: unknown) => {
    setEditing(null);
    if (s.view === "table") setTimeout(() => gridRef.current?.focus({ preventScroll: true }), 0);
    if ((r[c.key] ?? null) === (value ?? null) && !(local[r.id] && c.key in local[r.id])) return;
    setLocal((l) => ({ ...l, [r.id]: { ...l[r.id], [c.key]: value } }));
    start(async () => {
      const res = await updateField(table, r.id, c.key, value as string | number | boolean | null);
      if (res.error) {
        setError(res.error);
        setLocal((l) => { const n = { ...l[r.id] }; delete n[c.key]; return { ...l, [r.id]: n }; });
      } else { setError(null); router.refresh(); }
    });
  };

  const addRow = (extra: Record<string, unknown> = {}, given?: string) => {
    const title = given ?? window.prompt("Name of the new item");
    if (!title) return;
    start(async () => {
      const res = await createRow(table, { ...createDefaults, ...extra, [titleKey]: title } as Record<string, string | number | boolean | null>);
      if (res.error) setError(res.error); else { setError(null); router.refresh(); }
    });
  };
  const removeRow = (r: Row) => {
    if (!window.confirm(`Delete "${text(r, col(titleKey)!)}"? This can't be undone.`)) return;
    start(async () => {
      const res = await deleteRow(table, r.id);
      if (res.error) setError(res.error); else { setError(null); router.refresh(); }
    });
  };

  // ---- filter, search, sort
  const shown = useMemo(() => {
    let out = rows.filter((r) => {
      if (s.search) {
        const q = s.search.toLowerCase();
        if (!columns.some((c) => text(r, c).toLowerCase().includes(q))) return false;
      }
      return s.filters.every((f) => {
        const c = col(f.key); if (!c) return true;
        const raw = val(r, f.key);
        const t = raw === null || raw === undefined ? "" : String(raw);
        switch (f.op) {
          case "is": return t === f.value;
          case "not": return t !== f.value;
          case "contains": return text(r, c).toLowerCase().includes(f.value.toLowerCase());
          case "empty": return t === "";
          case "notempty": return t !== "";
          case "before": return t !== "" && t < f.value;
          case "after": return t !== "" && t > f.value;
        }
      });
    });
    if (s.sort) {
      const c = col(s.sort.key);
      const dir = s.sort.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const av = val(a, s.sort!.key), bv = val(b, s.sort!.key);
        if (av === bv) return 0;
        if (av === null || av === undefined || av === "") return 1;
        if (bv === null || bv === undefined || bv === "") return -1;
        if (c && ["number", "money", "progress"].includes(c.type)) return (Number(av) - Number(bv)) * dir;
        if (c && c.type === "select") {
          const order = c.options?.map((o) => o.value) ?? [];
          return (order.indexOf(String(av)) - order.indexOf(String(bv))) * dir;
        }
        return String(c ? text(a, c) : av).localeCompare(String(c ? text(b, c) : bv), undefined, { numeric: true }) * dir;
      });
    }
    return out;
  }, [rows, s, local]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleCols = columns.filter((c) => !s.hidden.includes(c.key));
  const groups = (key: string | null, list: Row[]) => {
    if (!key) return [{ key: "", label: "", rows: list }];
    const c = col(key)!;
    const order = c.options?.map((o) => o.value) ?? [...new Set(list.map((r) => String(val(r, key) ?? "")))].sort();
    const m = new Map<string, Row[]>(order.map((o) => [o, []]));
    list.forEach((r) => { const k = String(val(r, key) ?? ""); m.set(k, [...(m.get(k) ?? []), r]); });
    return [...m.entries()].filter(([, rs]) => rs.length || c.type === "select")
      .map(([k, rs]) => ({ key: k, label: c.options?.find((o) => o.value === k)?.label ?? (k || "No " + c.label.toLowerCase()), rows: rs }));
  };

  // ---- cells
  const display = (r: Row, c: Column) => {
    const v = val(r, c.key);
    if (v === null || v === undefined || v === "") return <span className="text-muted/50">—</span>;
    switch (c.type) {
      case "money": return <span className="tabular-nums">{egp.format(Number(v))}</span>;
      case "number": return <span className="tabular-nums">{Number(v).toLocaleString("en-GB", { maximumFractionDigits: 2 })}</span>;
      case "date": return fmtDate(String(v));
      case "checkbox": return v ? "✓" : "";
      case "progress": return (
        <span className="flex items-center gap-2"><span className="bar w-14"><span style={{ width: `${Math.round(Number(v) * 100)}%` }} /></span>
          <span className="text-xs tabular-nums text-muted">{Math.round(Number(v) * 100)}%</span></span>);
      case "select": { const o = c.options?.find((x) => x.value === v);
        return <span className={`badge badge-${o?.tone ?? TONES[String(v)] ?? "neutral"}`}>{o?.label ?? String(v)}</span>; }
      case "relation": return <span className="rounded bg-[var(--neutral-bg)] px-1.5 py-0.5 text-xs">{text(r, c)}</span>;
      case "url": return <a className="link" href={String(v)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open ↗</a>;
      case "longtext": return <span className="line-clamp-2">{String(v)}</span>;
      default: return String(v);
    }
  };
  const canEditCell = (c: Column) => editable && !!c.editable;
  const DEFAULT_W: Record<string, number> = { text: 150, longtext: 240, number: 90, money: 130, date: 130, select: 160, relation: 170, checkbox: 80, progress: 130, url: 90 };
  const widthOf = (c: Column) => s.widths?.[c.key] ?? c.width ?? (c.key === titleKey ? 300 : DEFAULT_W[c.type] ?? 140);
  const startResize = (e: React.MouseEvent, c: Column) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = widthOf(c);
    const onMove = (ev: MouseEvent) => setS((x) => ({ ...x, widths: { ...x.widths, [c.key]: Math.max(60, w0 + ev.clientX - x0) } }));
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  // Spreadsheet navigation: the rows in the order they are shown, and the visible columns.
  const flat = s.view === "table" ? groups(s.group, shown).flatMap((g) => (collapsed[g.key] ? [] : g.rows)) : shown;
  const moveSel = (from: { row: string; key: string }, dr: number, dc: number) => {
    const ri = flat.findIndex((r) => r.id === from.row), ci = visibleCols.findIndex((c) => c.key === from.key);
    const r = flat[Math.min(flat.length - 1, Math.max(0, ri + dr))], c = visibleCols[Math.min(visibleCols.length - 1, Math.max(0, ci + dc))];
    return r && c ? { row: r.id, key: c.key } : from;
  };
  const refocus = () => setTimeout(() => gridRef.current?.focus({ preventScroll: true }), 0);
  const startEdit = (r: Row, c: Column, seed?: string) => {
    if (!canEditCell(c)) return;
    if (c.type === "checkbox") { save(r, c, !val(r, c.key)); return; }
    setEditing({ row: r.id, key: c.key, seed });
  };

  const editor = (r: Row, c: Column, v: unknown, seed?: string) => {
    const finish = (e: React.KeyboardEvent, dr: number, dc: number) => {
      e.preventDefault();
      setSel(moveSel({ row: r.id, key: c.key }, dr, dc));
      (e.target as HTMLElement).blur();
    };
    const keys = (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") { setEditing(null); refocus(); }
      else if (e.key === "Tab") finish(e, 0, e.shiftKey ? -1 : 1);
      else if (e.key === "Enter" && !(c.type === "longtext" && e.shiftKey)) finish(e, 1, 0);
    };
    const common = { autoFocus: true, className: "input py-1", onKeyDown: keys };
    if (c.type === "select" || c.type === "relation") {
      return (
        <select {...common} defaultValue={String(v ?? "")} onChange={(e) => save(r, c, e.target.value || null)} onBlur={() => { setEditing(null); refocus(); }}>
          <option value="">—</option>
          {c.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (c.type === "progress") {
      return <input {...common} type="number" min={0} max={100} step={5} defaultValue={seed ?? Math.round(Number(v ?? 0) * 100)}
        onBlur={(e) => save(r, c, Number(e.target.value || 0) / 100)} />;
    }
    if (c.type === "longtext") {
      return <textarea {...common} rows={3} defaultValue={seed ?? String(v ?? "")} onBlur={(e) => save(r, c, e.target.value)} />;
    }
    const type = c.type === "date" ? "date" : ["number", "money"].includes(c.type) ? "number" : c.type === "url" ? "url" : "text";
    return <input {...common} type={type} step="any" defaultValue={seed ?? String(v ?? "").slice(0, type === "date" ? 10 : undefined)}
      onFocus={(e) => { if (seed && type === "text") { const n = e.target.value.length; e.target.setSelectionRange(n, n); } }}
      onBlur={(e) => save(r, c, type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)} />;
  };

  // Turn pasted spreadsheet text into a value for a column.
  const parseFor = (c: Column, raw: string): { ok: boolean; v: unknown } => {
    const t = raw.trim();
    if (t === "") return { ok: true, v: null };
    switch (c.type) {
      case "number": case "money": { const n = Number(t.replace(/[^0-9.\-]/g, "")); return { ok: !isNaN(n), v: n }; }
      case "progress": { const n = Number(t.replace(/[^0-9.\-]/g, "")); return { ok: !isNaN(n), v: t.includes("%") || n > 1 ? n / 100 : n }; }
      case "checkbox": return { ok: true, v: /^(true|yes|y|1|✓|x)$/i.test(t) };
      case "date": {
        let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return { ok: true, v: `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` };
        m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);   // day/month/year
        if (m) return { ok: true, v: `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` };
        const d = new Date(t + " UTC");
        return isNaN(d.getTime()) ? { ok: false, v: null } : { ok: true, v: d.toISOString().slice(0, 10) };
      }
      case "select": case "relation": {
        const o = c.options?.find((x) => x.value === t || x.label.toLowerCase() === t.toLowerCase());
        return o ? { ok: true, v: o.value } : { ok: false, v: null };
      }
      default: return { ok: true, v: t };
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (editing || !sel || !editable) return;
    const textData = e.clipboardData.getData("text/plain");
    if (!textData) return;
    e.preventDefault();
    const lines = textData.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
    const r0 = flat.findIndex((r) => r.id === sel.row), c0 = visibleCols.findIndex((c) => c.key === sel.key);
    const changes: { id: string; field: string; value: string | number | boolean | null }[] = [];
    const newRows: Record<string, string | number | boolean | null>[] = [];
    let skipped = 0;
    lines.forEach((cells, i) => {
      const r = flat[r0 + i];
      const extra: Record<string, string | number | boolean | null> = {};
      cells.forEach((raw, j) => {
        const c = visibleCols[c0 + j];
        if (!c || !c.editable) { if (c && raw.trim()) skipped++; return; }
        const p = parseFor(c, raw);
        if (!p.ok) { skipped++; return; }
        if (r) { if ((val(r, c.key) ?? null) !== p.v) changes.push({ id: r.id, field: c.key, value: p.v as string | number | boolean | null }); }
        else extra[c.key] = p.v as string | number | boolean | null;
      });
      if (!r && creatable && extra[titleKey]) newRows.push({ ...createDefaults, ...extra });
      else if (!r && cells.some((x) => x.trim())) skipped++;
    });
    if (!changes.length && !newRows.length) { setError(skipped ? "Nothing pasted: the values didn't match these columns." : null); return; }
    setLocal((l) => {
      const n = { ...l };
      changes.forEach((ch) => { n[ch.id] = { ...n[ch.id], [ch.field]: ch.value }; });
      return n;
    });
    start(async () => {
      const res = await bulkUpdate(table, changes, newRows);
      if (res.error) setError(res.error);
      else setError(skipped ? `Pasted. ${skipped} value${skipped === 1 ? "" : "s"} didn't fit the column and were skipped.` : null);
      router.refresh();
    });
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    if (editing || !sel) return;
    const r = flat.find((x) => x.id === sel.row), c = col(sel.key);
    if (!r || !c) return;
    const go = (dr: number, dc: number) => { e.preventDefault(); setSel(moveSel(sel, dr, dc)); };
    if (e.key === "ArrowDown") go(1, 0);
    else if (e.key === "ArrowUp") go(-1, 0);
    else if (e.key === "ArrowRight") go(0, 1);
    else if (e.key === "ArrowLeft") go(0, -1);
    else if (e.key === "Tab") go(0, e.shiftKey ? -1 : 1);
    else if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); startEdit(r, c); }
    else if (e.key === " " && c.type === "checkbox") { e.preventDefault(); startEdit(r, c); }
    else if ((e.key === "Delete" || e.key === "Backspace") && canEditCell(c) && c.key !== titleKey) { e.preventDefault(); save(r, c, c.type === "checkbox" ? false : null); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      const v = val(r, c.key);
      navigator.clipboard?.writeText(["select", "relation"].includes(c.type) ? text(r, c) : v === null || v === undefined ? "" : String(v)).catch(() => {});
    }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && canEditCell(c)) {
      e.preventDefault();
      if (["select", "relation"].includes(c.type)) startEdit(r, c);
      else if (c.type !== "checkbox" && c.type !== "date") startEdit(r, c, e.key);
      else startEdit(r, c);
    }
  };

  const rowHref = (r: Row) => (href ? href.replace(":id", r.id) : null);
  const titleCol = col(titleKey)!;
  const newField = { label: "", type: "text", options: "", client_visible: false };

  // ---- views
  const tableView = (
    <div>
      <div ref={gridRef} tabIndex={0} onKeyDown={onGridKey} onPaste={onPaste}
        className={`overflow-auto outline-none ${fullPage ? "max-h-[calc(100vh-15rem)] rounded-lg border border-line bg-surface" : "-mx-4"}`}>
        <table className="text-sm" style={{ tableLayout: "fixed", width: visibleCols.reduce((t, c) => t + widthOf(c), 0) + 40, minWidth: "100%" }}>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              {visibleCols.map((c) => (
                <th key={c.key} style={{ width: widthOf(c) }}
                  className={`group/h sticky top-0 z-[1] cursor-pointer select-none truncate border-b border-line bg-surface px-3 py-2 font-medium hover:text-fg ${["number", "money"].includes(c.type) ? "text-right" : ""}`}
                  onClick={() => setS({ ...s, sort: s.sort?.key === c.key ? (s.sort.dir === "asc" ? { key: c.key, dir: "desc" } : null) : { key: c.key, dir: "asc" } })}>
                  {c.label}{s.sort?.key === c.key ? (s.sort.dir === "asc" ? " ↑" : " ↓") : ""}
                  {canManageFields && c.custom && (
                    <button title="Edit column" className="ml-1 rounded px-1 normal-case text-muted opacity-0 hover:bg-[var(--neutral-bg)] group-hover/h:opacity-100"
                      onClick={(e) => { e.stopPropagation(); setPanel(null); setFieldForm({ id: c.custom!.id, label: c.label, type: c.type, options: c.custom!.options.join(", "), client_visible: c.custom!.client_visible }); }}>⋯</button>
                  )}
                  <span title="Drag to resize" onMouseDown={(e) => startResize(e, c)} onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[var(--brand)]/40" />
                </th>
              ))}
              {canManageFields
                ? <th className="sticky top-0 z-[1] w-10 border-b border-line bg-surface px-1"><button title="Add a column" onClick={() => { setPanel(null); setFieldForm(newField); }} className="rounded px-2 py-0.5 text-base text-muted hover:bg-[var(--neutral-bg)] hover:text-fg">+</button></th>
                : <th className="sticky top-0 z-[1] w-10 border-b border-line bg-surface" />}
            </tr>
          </thead>
          <tbody>
            {groups(s.group, shown).map((g) => groupRows(g))}
            {creatable && (
              <tr className="border-b border-line">
                <td colSpan={visibleCols.length + 1} className="px-3 py-1">
                  <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="+ New row: type a name and press Enter"
                    className="w-full rounded bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted focus:bg-[var(--neutral-bg)]"
                    onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) { const t = newTitle.trim(); setNewTitle(""); addRow({}, t); } }} />
                </td>
              </tr>
            )}
            <tr className="font-medium">
              {visibleCols.map((c, i) => (
                <td key={c.key} className={`px-4 py-2 ${["number", "money"].includes(c.type) ? "text-right tabular-nums" : "text-xs text-muted"}`}>
                  {i === 0 ? `${shown.length} ${shown.length === 1 ? "row" : "rows"}` : c.sum ? (c.type === "money" ? egp.format(shown.reduce((t, r) => t + Number(val(r, c.key) ?? 0), 0)) : shown.reduce((t, r) => t + Number(val(r, c.key) ?? 0), 0).toLocaleString()) : ""}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      {editable && <p className="mt-2 text-xs text-muted">Click a cell and type to edit. Arrow keys and Tab move, Enter edits or saves, Delete clears. You can paste a block of cells from Excel or Google Sheets; extra lines become new rows.</p>}
    </div>
  );

  function groupRows(g: { key: string; label: string; rows: Row[] }) {
    const open = !collapsed[g.key];
    return (
      <Fragment key={g.key}>
        {s.group && (
          <tr className="bg-[var(--neutral-bg)]/60">
            <td colSpan={visibleCols.length + 1} className="px-4 py-1.5 text-xs font-semibold">
              <button onClick={() => setCollapsed({ ...collapsed, [g.key]: open })} className="mr-2">{open ? "▾" : "▸"}</button>{g.label}
              <span className="ml-2 font-normal text-muted">{g.rows.length}</span>
              {columns.filter((c) => c.sum && c.type === "money" && !s.hidden.includes(c.key)).map((c) => (
                <span key={c.key} className="ml-3 font-normal text-muted">{c.label}: {egp.format(g.rows.reduce((t, r) => t + Number(val(r, c.key) ?? 0), 0))}</span>
              ))}
            </td>
          </tr>
        )}
        {open && g.rows.map((r) => (
          <tr key={r.id} className="group border-b border-line align-top">
            {visibleCols.map((c) => {
              const here = sel?.row === r.id && sel.key === c.key;
              const isEditing = editing?.row === r.id && editing.key === c.key;
              return (
                <td key={c.key} className={`px-3 py-1 ${here && !isEditing ? "outline outline-2 -outline-offset-2 outline-[var(--brand)]" : ""}`}
                  onClick={() => {
                    if (isEditing) return;
                    if (here && canEditCell(c)) { startEdit(r, c); return; }
                    setSel({ row: r.id, key: c.key }); gridRef.current?.focus({ preventScroll: true });
                  }}
                  onDoubleClick={() => startEdit(r, c)}>
                  {isEditing ? editor(r, c, val(r, c.key), editing?.seed) : (
                    <div className="flex items-start gap-1">
                      <div className={`min-h-[1.75rem] min-w-0 flex-1 break-words rounded px-1 py-0.5 ${canEditCell(c) ? "cursor-cell" : ""} ${["number", "money"].includes(c.type) ? "text-right" : ""}`}>{display(r, c)}</div>
                      {c.key === titleKey && rowHref(r) && <Link href={rowHref(r)!} title="Open as page" onClick={(e) => e.stopPropagation()}
                        className="invisible mt-0.5 shrink-0 rounded border border-line px-1.5 text-xs text-muted hover:text-fg group-hover:visible">Open</Link>}
                    </div>
                  )}
                </td>
              );
            })}
            <td className="px-1 py-1 text-right">
              {editable && <button title="Delete row" onClick={() => removeRow(r)} className="invisible rounded px-1.5 text-muted hover:text-[var(--bad)] group-hover:visible">×</button>}
            </td>
          </tr>
        ))}
      </Fragment>
    );
  }
  const boardKey = s.boardBy && col(s.boardBy)?.type === "select" ? s.boardBy : firstSelect;
  const boardView = boardKey ? (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
      {groups(boardKey, shown).map((g) => (
        <div key={g.key} className="w-72 shrink-0 rounded-xl bg-[var(--neutral-bg)]/60 p-2"
          onDragOver={(e) => editable && e.preventDefault()}
          onDrop={(e) => { const rid = e.dataTransfer.getData("text/row"); const r = rows.find((x) => x.id === rid); if (r) save(r, col(boardKey)!, g.key || null); }}>
          <div className="mb-2 flex items-center justify-between px-1 text-sm">
            <span className={`badge badge-${TONES[g.key] ?? "neutral"}`}>{g.label}</span>
            <span className="text-xs text-muted">{g.rows.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {g.rows.map((r) => (
              <div key={r.id} draggable={editable} onDragStart={(e) => e.dataTransfer.setData("text/row", r.id)}
                className={`rounded-lg border border-line bg-surface p-2.5 text-sm shadow-sm ${editable ? "cursor-grab" : ""}`}>
                <div className="font-medium">{rowHref(r) ? <Link className="hover:underline" href={rowHref(r)!}>{text(r, titleCol) || "Untitled"}</Link> : text(r, titleCol)}</div>
                <div className="mt-1.5 flex flex-col gap-1 text-xs text-muted">
                  {visibleCols.filter((c) => c.key !== titleKey && c.key !== boardKey && val(r, c.key) !== null && val(r, c.key) !== "" && val(r, c.key) !== undefined).slice(0, 4).map((c) => (
                    <div key={c.key} className="flex justify-between gap-2"><span>{c.label}</span><span className="text-fg">{display(r, c)}</span></div>
                  ))}
                </div>
              </div>
            ))}
            {creatable && <button onClick={() => addRow({ [boardKey]: g.key || null })} className="rounded-lg px-2 py-1.5 text-left text-xs text-muted hover:bg-surface">+ New</button>}
          </div>
        </div>
      ))}
    </div>
  ) : <p className="text-sm text-muted">Board view needs a status-type column.</p>;

  const dateKey = s.dateBy && col(s.dateBy)?.type === "date" ? s.dateBy : firstDate;
  const calendarView = dateKey ? (() => {
    const [y, m] = s.month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7; // Monday first
    const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = Array.from({ length: Math.ceil((offset + daysIn) / 7) * 7 }, (_, i) => i - offset + 1);
    const today = new Date().toISOString().slice(0, 10);
    const move = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setS({ ...s, month: d.toISOString().slice(0, 7) }); };
    return (
      <div>
        <div className="mb-2 flex items-center gap-2">
          <button className="btn btn-sm" onClick={() => move(-1)}>←</button>
          <span className="w-40 text-center font-medium">{first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
          <button className="btn btn-sm" onClick={() => move(1)}>→</button>
          <button className="btn btn-sm" onClick={() => setS({ ...s, month: today.slice(0, 7) })}>Today</button>
          <span className="ml-auto text-xs text-muted">Drag an item to another day to change its {col(dateKey)!.label.toLowerCase()}</span>
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-line text-xs">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="border-b border-line bg-[var(--neutral-bg)]/60 px-2 py-1 font-medium text-muted">{d}</div>)}
          {cells.map((d, i) => {
            const iso = d >= 1 && d <= daysIn ? `${s.month}-${String(d).padStart(2, "0")}` : null;
            const items = iso ? shown.filter((r) => String(val(r, dateKey) ?? "").slice(0, 10) === iso) : [];
            return (
              <div key={i} className={`min-h-24 border-b border-r border-line p-1 ${iso ? "" : "bg-[var(--neutral-bg)]/30"}`}
                onDragOver={(e) => editable && iso && e.preventDefault()}
                onDrop={(e) => { const r = rows.find((x) => x.id === e.dataTransfer.getData("text/row")); if (r && iso) save(r, col(dateKey)!, iso); }}>
                {iso && <div className={`mb-1 text-right ${iso === today ? "font-bold text-[var(--bad)]" : "text-muted"}`}>{d}</div>}
                {items.map((r) => (
                  <div key={r.id} draggable={editable} onDragStart={(e) => e.dataTransfer.setData("text/row", r.id)}
                    className="mb-1 truncate rounded bg-[var(--info-bg)] px-1.5 py-0.5 text-[var(--info)]">
                    {rowHref(r) ? <Link href={rowHref(r)!}>{text(r, titleCol)}</Link> : text(r, titleCol)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  })() : <p className="text-sm text-muted">Calendar view needs a date column.</p>;

  const listView = (
    <ul className="flex flex-col divide-y divide-[var(--line)]">
      {shown.map((r) => (
        <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
          <span className="flex-1">{rowHref(r) ? <Link className="link" href={rowHref(r)!}>{text(r, titleCol)}</Link> : text(r, titleCol)}</span>
          {visibleCols.filter((c) => c.type === "select").slice(0, 2).map((c) => <span key={c.key}>{display(r, c)}</span>)}
          {dateKey && <span className="w-28 text-right text-xs text-muted">{val(r, dateKey) ? fmtDate(String(val(r, dateKey))) : ""}</span>}
        </li>
      ))}
    </ul>
  );

  // ---- toolbar
  const fieldAction = (fn: () => Promise<{ error?: string }>, keepOpen = false) => {
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error); else { setError(null); if (!keepOpen) setFieldForm(null); router.refresh(); }
    });
  };
  const opLabels: Record<Filter["op"], string> = { is: "is", not: "is not", contains: "contains", empty: "is empty", notempty: "is not empty", before: "before", after: "after" };
  const VIEW_LABEL: Record<ViewKind, string> = { table: "Table", board: "Board", calendar: "Calendar", list: "List" };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-3">
        <div className="flex gap-1">
          {views.map((v) => (
            <button key={v} onClick={() => setS({ ...s, view: v })} className={`btn btn-sm ${s.view === v ? "btn-primary" : ""}`}>{VIEW_LABEL[v]}</button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <input value={s.search} onChange={(e) => setS({ ...s, search: e.target.value })} placeholder="Search…" className="input w-40 py-1" />
          {(["filter", "sort", "group", "fields"] as const).map((p) => (
            <button key={p} onClick={() => setPanel(panel === p ? null : p)}
              className={`btn btn-sm ${panel === p ? "btn-primary" : ""}`}>
              {p === "filter" ? `Filter${s.filters.length ? ` (${s.filters.length})` : ""}` : p === "sort" ? "Sort" : p === "group" ? (s.view === "board" ? "Board by" : s.view === "calendar" ? "Date field" : "Group") : "Fields"}
            </button>
          ))}
          {creatable && <button onClick={() => addRow()} className="btn btn-sm btn-primary">+ New</button>}
        </div>
      </div>

      {panel && (
        <div className="mb-3 rounded-lg border border-line p-3 text-sm">
          {panel === "filter" && (
            <div className="flex flex-col gap-2">
              {s.filters.map((f, i) => {
                const c = col(f.key);
                const setF = (patch: Partial<Filter>) => setS({ ...s, filters: s.filters.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select className="input w-44 py-1" value={f.key} onChange={(e) => setF({ key: e.target.value, value: "" })}>
                      {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <select className="input w-36 py-1" value={f.op} onChange={(e) => setF({ op: e.target.value as Filter["op"] })}>
                      {(Object.keys(opLabels) as Filter["op"][]).filter((o) => c?.type === "date" ? o !== "contains" : !["before", "after"].includes(o)).map((o) => <option key={o} value={o}>{opLabels[o]}</option>)}
                    </select>
                    {!["empty", "notempty"].includes(f.op) && (c?.options ? (
                      <select className="input w-48 py-1" value={f.value} onChange={(e) => setF({ value: e.target.value })}>
                        <option value="">—</option>{c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : <input className="input w-48 py-1" type={c?.type === "date" ? "date" : "text"} value={f.value} onChange={(e) => setF({ value: e.target.value })} />)}
                    <button className="btn btn-sm" onClick={() => setS({ ...s, filters: s.filters.filter((_, j) => j !== i) })}>Remove</button>
                  </div>
                );
              })}
              <div><button className="btn btn-sm" onClick={() => setS({ ...s, filters: [...s.filters, { key: firstSelect ?? titleKey, op: "is", value: "" }] })}>+ Add filter</button></div>
            </div>
          )}
          {panel === "sort" && (
            <div className="flex flex-wrap items-center gap-2">
              <select className="input w-48 py-1" value={s.sort?.key ?? ""} onChange={(e) => setS({ ...s, sort: e.target.value ? { key: e.target.value, dir: s.sort?.dir ?? "asc" } : null })}>
                <option value="">No sorting</option>{columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              {s.sort && (
                <select className="input w-36 py-1" value={s.sort.dir} onChange={(e) => setS({ ...s, sort: { ...s.sort!, dir: e.target.value as "asc" | "desc" } })}>
                  <option value="asc">Ascending</option><option value="desc">Descending</option>
                </select>
              )}
            </div>
          )}
          {panel === "group" && (
            <div className="flex flex-wrap items-center gap-2">
              {s.view === "board" ? (
                <select className="input w-48 py-1" value={boardKey ?? ""} onChange={(e) => setS({ ...s, boardBy: e.target.value })}>
                  {columns.filter((c) => c.type === "select").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              ) : s.view === "calendar" ? (
                <select className="input w-48 py-1" value={dateKey ?? ""} onChange={(e) => setS({ ...s, dateBy: e.target.value })}>
                  {columns.filter((c) => c.type === "date").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              ) : (
                <select className="input w-48 py-1" value={s.group ?? ""} onChange={(e) => setS({ ...s, group: e.target.value || null })}>
                  <option value="">No grouping</option>
                  {columns.filter((c) => ["select", "relation", "text"].includes(c.type)).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              )}
            </div>
          )}
          {panel === "fields" && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {columns.filter((c) => c.key !== titleKey).map((c) => (
                <label key={c.key} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!s.hidden.includes(c.key)}
                    onChange={(e) => setS({ ...s, hidden: e.target.checked ? s.hidden.filter((h) => h !== c.key) : [...s.hidden, c.key] })} />{c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {fieldForm && fieldsTable && (
        <div className="mb-3 rounded-lg border border-line p-3 text-sm">
          <div className="mb-2 font-medium">{fieldForm.id ? "Edit column" : "New column"}</div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">Name
              <input autoFocus className="input w-48 py-1 text-sm text-fg" value={fieldForm.label} onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Type
              <select className="input w-40 py-1 text-sm text-fg" value={fieldForm.type} onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value })}>
                {Object.entries(FIELD_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            {fieldForm.type === "select" && (
              <label className="flex flex-col gap-1 text-xs text-muted">Choices, separated by commas
                <input className="input w-72 py-1 text-sm text-fg" value={fieldForm.options} placeholder="Option A, Option B" onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })} /></label>
            )}
            {fieldsTable === "work_items" && (
              <label className="flex items-center gap-1.5 pb-1.5"><input type="checkbox" checked={fieldForm.client_visible}
                onChange={(e) => setFieldForm({ ...fieldForm, client_visible: e.target.checked })} />Clients and consultants can see it</label>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-sm btn-primary" disabled={!fieldForm.label.trim()} onClick={() => fieldAction(() => saveCustomField({
              id: fieldForm.id, table_name: fieldsTable, label: fieldForm.label, type: fieldForm.type,
              options: fieldForm.options.split(","), client_visible: fieldForm.client_visible }))}>{fieldForm.id ? "Save" : "Add column"}</button>
            {fieldForm.id && <>
              <button className="btn btn-sm" onClick={() => fieldAction(() => moveCustomField(fieldForm.id!, -1), true)}>← Move left</button>
              <button className="btn btn-sm" onClick={() => fieldAction(() => moveCustomField(fieldForm.id!, 1), true)}>Move right →</button>
              <button className="btn btn-sm text-[var(--bad)]" onClick={() => {
                if (window.confirm(`Delete the column "${fieldForm.label}" and everything typed in it? This can't be undone.`)) fieldAction(() => deleteCustomField(fieldForm.id!));
              }}>Delete column</button>
            </>}
            <button className="btn btn-sm" onClick={() => setFieldForm(null)}>Cancel</button>
          </div>
        </div>
      )}

      {(pending || error) && (
        <p className={`mb-2 text-xs ${error ? "text-[var(--bad)]" : "text-muted"}`}>{error ? `Couldn't save: ${error}` : "Saving…"}</p>
      )}

      {s.view === "table" && tableView}
      {s.view === "board" && boardView}
      {s.view === "calendar" && calendarView}
      {s.view === "list" && listView}
    </div>
  );
}
