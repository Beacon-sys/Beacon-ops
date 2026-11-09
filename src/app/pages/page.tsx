import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe, isInternal } from "@/lib/data";
import { PageTitle, Card } from "@/components/ui";
import { ErrorNote } from "@/components/error-note";
import { createPage } from "@/app/page-actions";

type P = { id: string; parent_id: string | null; title: string; icon: string | null };

export default async function Pages({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, me } = await requireMe();
  if (!isInternal(me.role)) redirect("/");
  const { error } = await searchParams;
  const { data } = await supabase.from("pages").select("id,parent_id,title,icon").order("position");
  const pages = (data ?? []) as P[];
  const tree = (parent: string | null, depth: number): React.ReactNode[] =>
    pages.filter((p) => p.parent_id === parent).flatMap((p) => [
      <Link key={p.id} href={`/pages/${p.id}`} style={{ paddingLeft: 8 + depth * 20 }}
        className="block rounded-md py-1.5 pr-2 text-sm hover:bg-[var(--neutral-bg)]">{p.icon ?? "📄"} {p.title}</Link>,
      ...tree(p.id, depth + 1),
    ]);
  return (
    <>
      <PageTitle title="Pages" sub="Your own pages: notes plus live tables and boards from any database. Pages can sit inside other pages."
        action={<form action={createPage}><button className="btn btn-primary">+ New page</button></form>} />
      <ErrorNote error={error} />
      <Card>{pages.length ? tree(null, 0) : <p className="py-6 text-center text-sm text-muted">No pages yet. Click “New page” to make one.</p>}</Card>
    </>
  );
}
