"use client";

import { useState, useTransition } from "react";
import { T, useT } from "@/components/i18n";
import { useRouter } from "next/navigation";
import { updateField } from "@/app/db-actions";

type M = { id: string; title: string; meeting_date: string; kind: string; location: string | null; attendees: string | null; notes: string | null };

/** Meeting details and minutes; every field saves when you click away. */
export function MeetingNotes({ meeting, editable, kindLabel, kinds }: { meeting: M; editable: boolean; kindLabel: string; kinds: [string, string][] }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (field: keyof M, value: string) => {
    if ((meeting[field] ?? "") === value) return;
    start(async () => {
      const res = await updateField("meetings", meeting.id, field, value);
      if (res.error) setError(res.error); else { setError(null); router.refresh(); }
    });
  };
  const grow = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; };
  const field = "rounded bg-transparent px-1 py-0.5 outline-none hover:bg-[var(--neutral-bg)]/60 focus:bg-[var(--neutral-bg)]/60";
  return (
    <div>
      <input defaultValue={meeting.title} readOnly={!editable} aria-label={t("Meeting title")} onBlur={(e) => save("title", e.target.value || meeting.title)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={`w-full text-3xl font-semibold tracking-tight ${field}`} />
      <div className="mt-3 grid max-w-3xl grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
        <span className="py-0.5 text-muted"><T>{"Date"}</T></span>
        <input type="date" readOnly={!editable} defaultValue={meeting.meeting_date} onBlur={(e) => e.target.value && save("meeting_date", e.target.value)} className={`w-44 ${field}`} />
        <span className="py-0.5 text-muted"><T>{"Type"}</T></span>
        {editable ? (
          <select defaultValue={meeting.kind} onChange={(e) => save("kind", e.target.value)} className={`w-52 ${field}`}>
            {kinds.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
          </select>
        ) : <span className="py-0.5">{t(kindLabel)}</span>}
        <span className="py-0.5 text-muted"><T>{"Location"}</T></span>
        <input readOnly={!editable} defaultValue={meeting.location ?? ""} placeholder={t("Site office, online…")} onBlur={(e) => save("location", e.target.value)} className={field} />
        <span className="py-0.5 text-muted"><T>{"Attendees"}</T></span>
        <textarea readOnly={!editable} rows={1} defaultValue={meeting.attendees ?? ""} placeholder={t("Who was there")} ref={(el) => { if (el) grow(el); }}
          onInput={(e) => grow(e.currentTarget)} onBlur={(e) => save("attendees", e.target.value)} className={`resize-none overflow-hidden ${field}`} />
      </div>
      <h2 className="mb-2 mt-6 text-lg font-semibold"><T>{"Notes"}</T></h2>
      <textarea readOnly={!editable} defaultValue={meeting.notes ?? ""} placeholder={t("Minutes of the meeting…")} ref={(el) => { if (el) grow(el); }}
        onInput={(e) => grow(e.currentTarget)} onBlur={(e) => save("notes", e.target.value)}
        className={`min-h-32 w-full resize-none overflow-hidden rounded-lg border border-line p-3 text-[15px] leading-relaxed outline-none focus:border-[var(--brand)]`} />
      {(pending || error) && <p className={`mt-1 text-xs ${error ? "text-[var(--bad)]" : "text-muted"}`}>{error ?? t("Saving…")}</p>}
    </div>
  );
}
