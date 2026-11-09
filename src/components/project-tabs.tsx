import Link from "next/link";

/** Title and page tabs shown at the top of every project sub-page. */
export function ProjectHeader({ id, name, code, current, internal }: {
  id: string; name: string; code?: string | null; current: string; internal: boolean;
}) {
  const tabs = [
    ["overview", "Overview", `/projects/${id}`],
    ["work-items", "Work items", `/projects/${id}/work-items`],
    ...(internal ? [["tasks", "Site tasks", `/projects/${id}/tasks`], ["meetings", "Meetings", `/projects/${id}/meetings`], ["purchasing", "Purchasing", `/projects/${id}/purchasing`]] : []),
    ["submittals", "Submittals", `/submittals?project=${id}`],
    ["timeline", "Timeline", `/projects/${id}/timeline`],
  ];
  return (
    <div className="mb-4">
      <div className="text-xs text-muted"><Link className="hover:underline" href="/projects">Projects</Link> / {code ?? ""}</div>
      <h1 className="mb-3 text-2xl font-semibold tracking-tight">{name}</h1>
      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([k, l, h]) => (
          <Link key={k} href={h} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${k === current ? "border-[var(--brand)] font-medium text-fg" : "border-transparent text-muted hover:text-fg"}`}>{l}</Link>
        ))}
      </div>
    </div>
  );
}
