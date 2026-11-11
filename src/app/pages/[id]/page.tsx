import Link from "next/link";
import { T } from "@/components/i18n";
import { notFound, redirect } from "next/navigation";
import { requireMe, isInternal } from "@/lib/data";
import { loadSource, SOURCES, type Source, type Loaded } from "@/lib/sources";
import { PageEditor, type Block } from "@/components/page-editor";
import { createPage } from "@/app/page-actions";

type PageRow = { id: string; parent_id: string | null; title: string; icon: string | null; position: number };

export default async function CustomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, me } = await requireMe();
  if (!isInternal(me.role)) redirect("/");
  const [{ data: page }, { data: all }, { data: blocks }, { data: projects }] = await Promise.all([
    supabase.from("pages").select("*").eq("id", id).maybeSingle(),
    supabase.from("pages").select("id,parent_id,title,icon,position").order("position"),
    supabase.from("page_blocks").select("*").eq("page_id", id).order("position").order("created_at"),
    supabase.from("projects").select("id,name").neq("status", "closed").order("name"),
  ]);
  if (!page) notFound();
  const pages = (all ?? []) as PageRow[];
  const byId = new Map(pages.map((p) => [p.id, p]));
  const trail: PageRow[] = [];
  for (let cur = page.parent_id ? byId.get(page.parent_id) : undefined; cur && trail.length < 20; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) trail.unshift(cur);
  const children = pages.filter((p) => p.parent_id === id);

  const loaded: Block[] = await Promise.all((blocks ?? []).map(async (b) => ({
    ...b,
    data: b.kind === "view" && b.source in SOURCES ? await loadSource(supabase, me, b.source as Source, b.project_id) : null as Loaded | null,
  })));

  return (
    <div className="full-bleed mx-auto max-w-[1400px]">
      <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted">
        <Link className="hover:underline" href="/pages"><T>{"Pages"}</T></Link>
        {trail.map((t) => <span key={t.id}> / <Link className="hover:underline" href={`/pages/${t.id}`}>{t.icon ? `${t.icon} ` : ""}{t.title}</Link></span>)}
      </div>
      <PageEditor page={page} blocks={loaded} projects={projects ?? []} pages={pages}
        canManageFields={me.role === "management"} sources={SOURCES} />
      <div className="mt-10 border-t border-line pt-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted"><T>{"Pages inside this page"}</T></div>
        <div className="flex flex-col">
          {children.map((c) => (
            <Link key={c.id} href={`/pages/${c.id}`} className="rounded-md px-2 py-1.5 text-sm hover:bg-[var(--neutral-bg)]">
              {c.icon ?? "📄"} {c.title}
            </Link>
          ))}
        </div>
        <form action={createPage} className="mt-1">
          <input type="hidden" name="parent_id" value={id} />
          <button className="rounded-md px-2 py-1.5 text-sm text-muted hover:bg-[var(--neutral-bg)] hover:text-fg"><T>{"+ Add a page inside"}</T></button>
        </form>
      </div>
    </div>
  );
}
