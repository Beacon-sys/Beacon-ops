import Link from "next/link";
import { money, date } from "@/lib/data";
import { Table, Badge, Progress } from "@/components/ui";

export type ProjectRow = {
  id: string; name: string; code: string | null; status: string; avg_progress: number | null;
  committed_spend: number | null; contract_value: number | null; planned_finish: string | null;
};

export function ProjectList({ projects, showMoney }: { projects: ProjectRow[]; showMoney: boolean }) {
  return (
    <Table head={["Project", "Status", "Progress", "Planned finish", ...(showMoney ? ["Committed", "Contract"] : [])]} empty={!projects.length}>
      {projects.map((p) => (
        <tr key={p.id}>
          <td>
            <Link className="link" href={`/projects/${p.id}`}>{p.name}</Link>
            {p.code && <span className="ml-2 text-muted">{p.code}</span>}
          </td>
          <td><Badge set="project_status" value={p.status} /></td>
          <td><Progress v={p.avg_progress} /></td>
          <td>{date(p.planned_finish)}</td>
          {showMoney && (
            <>
              <td className="tabular-nums">{money(p.committed_spend)}</td>
              <td className="tabular-nums">{money(p.contract_value)}</td>
            </>
          )}
        </tr>
      ))}
    </Table>
  );
}
