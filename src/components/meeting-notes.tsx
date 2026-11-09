"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateField } from "@/app/db-actions";

type M = { id: string; title: string; meeting_date: string; kind: string; location: string | null; attendees: string | null; notes: string | null };

/** Meeting details and minutes; every field saves when you click away. */
export function MeetingNotes({ meeting, editable, kindLabel, kinds }: { meeting: M; editable: boolean; kindLabel: string; kinds: [string, string][] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (field: keyof M, value: string) => {
    if ((meeting[field] ?? "") === value) return;
    start(async () => {
      const res = await updateField("meetings", meeting.id, field, value);
      if (res.error) setError(res.error); else { setError(null); router.refresh(); }
    });
  };
  const grow = (t: HTMLTextAreaElement) => { t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; };
  const field = "rounded bg-transparent px-1 py-0.5 outline-none hover:bg-[var(--neutral-bg)]/60 focus:bg-[var(--neutral-bg)]/60";
  return (
    <div>
      <input defaultValue={meeting.title} readOnly={!editable} aria-label="Meeting title" onBlur={(e) => save("title", e.target.value || meeting.title)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={`w-full text-3xl font-semibold tracking-tight ${field}`} />
      <div className="mt-3 grid max-w-3xl grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
        <span className="py-0.5 text-muted">Date</span>
        <input type="date" readOnly={!editable} defaultValue={meeting.meeting_date} onBlur={(e) => e.target.value && save("meeting_date", e.target.value)} className={`w-44 ${field}`} />
        <span className="py-0.5 text-muted">Type</span>
        {editable ? (
          <select defaultValue={meeting.kind} onChange={(e) => save("kind", e.target.value)} className={`w-52 ${field}`}>
            {kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        ) : <span className="py-0.5">{kindLabel}</span>}
        <span className="py-0.5 text-muted">Location</span>
        <input readOnly={!editable} defaultValue={meeting.location ?? ""} placeholder="Site office, online…" onBlur={(e) => save("location", e.target.value)} className={field} />
        <span className="py-0.5 text-muted">Attendees</span>
        <textarea readOnly={!editable} rows={1} defaultValue={meeting.attendees ?? ""} placeholder="Who was there" ref={(t) => { if (t) grow(t); }}
          onInput={(e) => grow(e.currentTarget)} onBlur={(e) => save("attendees", e.target.value)} className={`resize-none overflow-hidden ${field}`} />
      </div>
      <h2 className="mb-2 mt-6 text-lg font-semibold">Notes</h2>
      <textarea readOnly={!editable} defaultValue={meeting.notes ?? ""} placeholder="Minutes of the meeting…" ref={(t) => { if (t) grow(t); }}
        onInput={(e) => grow(e.currentTarget)} onBlur={(e) => save("notes", e.target.value)}
        className={`min-h-32 w-full resize-none overflow-hidden rounded-lg border border-line p-3 text-[15px] leading-relaxed outline-none focus:border-[var(--brand)]`} />
      {(pending || error) && <p className={`mt-1 text-xs ${error ? "text-[var(--bad)]" : "text-muted"}`}>{error ?? "Saving…"}</p>}
    </div>
  );
}
