"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createPage } from "@/app/page-actions";

export type PageItem = { id: string; parent_id: string | null; title: string; icon: string | null };

export type SubItem = { href: string; label: string; children?: SubItem[] };
export type NavItem = { href: string; label: string; icon: string; group?: string; children?: SubItem[] };

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  folder: <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />,
  check: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m8 12 3 3 5-6" /></>,
  cart: <><path d="M3 4h2l2.5 11h11L21 7H6.2" /><circle cx="9" cy="19.5" r="1.3" /><circle cx="18" cy="19.5" r="1.3" /></>,
  chart: <><path d="M4 5h9M7 10h11M4 15h7M9 20h10" /></>,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  coins: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  people: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.2c2.9.4 5 2.8 5 5.8" /></>,
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
  );
}

export function Sidebar({ items, name, roleLabel, signOut, pages }: {
  items: NavItem[]; name: string; roleLabel: string; signOut: () => Promise<void>; pages?: PageItem[];
}) {
  const path = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const inSection = (n: NavItem) =>
    (n.href === "/" ? path === "/" : path === n.href || path.startsWith(n.href + "/")) ||
    (n.children ?? []).some((c) => {
      const base = c.href.split(/[?#]/)[0];
      return base === path && base.startsWith(n.href);
    });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (n: NavItem) => expanded[n.href] ?? inSection(n);

  // A sub-link is current when its path and every query value it names match the page.
  const subActive = (href: string) => {
    const [base, query] = href.split("#")[0].split("?");
    if (base !== path) return false;
    const want = [...new URLSearchParams(query ?? "").entries()];
    return want.length ? want.every(([k, v]) => search.get(k) === v) : !href.includes("#") && !search.get("view");
  };
  // A project entry is open while any of its pages is showing.
  const inProject = (c: SubItem) => {
    const pid = c.href.split("/")[2];
    return path === c.href || path.startsWith(c.href + "/") || (!!pid && search.get("project") === pid);
  };
  const subOpen = (c: SubItem) => expanded[c.href] ?? inProject(c);
  const chevron = (open: boolean) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
  );

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map((n, i) => {
        const here = inSection(n);
        const kids = n.children ?? [];
        return (
          <div key={n.href}>
            {n.group && n.group !== items[i - 1]?.group && (
              <div className="mb-1 mt-4 px-3 text-xs font-medium uppercase tracking-wide text-muted">{n.group}</div>
            )}
            <div className={`flex items-center rounded-lg ${here ? "bg-[var(--info-bg)] text-[var(--brand)]" : "text-muted hover:bg-[var(--neutral-bg)] hover:text-fg"}`}>
              <Link href={n.href} onClick={() => setOpen(false)}
                className={`flex flex-1 items-center gap-3 px-3 py-2 text-sm ${here ? "font-medium" : ""}`}>
                <Icon name={n.icon} />{n.label}
              </Link>
              {kids.length > 0 && (
                <button type="button" aria-label={`${isOpen(n) ? "Hide" : "Show"} ${n.label} pages`} aria-expanded={isOpen(n)}
                  onClick={() => setExpanded({ ...expanded, [n.href]: !isOpen(n) })}
                  className="mr-1 rounded-md p-1.5 hover:bg-[var(--neutral-bg)]">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                    className={`transition-transform ${isOpen(n) ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
                </button>
              )}
            </div>
            {kids.length > 0 && isOpen(n) && (
              <div className="mb-1 ml-[1.35rem] mt-0.5 flex flex-col border-l border-line pl-3">
                {kids.map((c) => c.children?.length ? (
                  <div key={c.href}>
                    <div className={`flex items-center rounded-md ${inProject(c) ? "text-[var(--brand)]" : "text-muted hover:text-fg"}`}>
                      <Link href={c.href} onClick={() => setOpen(false)}
                        className={`flex-1 truncate px-2 py-1.5 text-[13px] ${inProject(c) ? "font-medium" : ""}`}>{c.label}</Link>
                      <button type="button" aria-label={`${subOpen(c) ? "Hide" : "Show"} ${c.label} pages`} aria-expanded={subOpen(c)}
                        onClick={() => setExpanded({ ...expanded, [c.href]: !subOpen(c) })}
                        className="rounded-md p-1 hover:bg-[var(--neutral-bg)]">{chevron(subOpen(c))}</button>
                    </div>
                    {subOpen(c) && (
                      <div className="mb-1 ml-2 flex flex-col border-l border-line pl-2">
                        {c.children.map((g) => (
                          <Link key={g.href} href={g.href} onClick={() => setOpen(false)}
                            className={`truncate rounded-md px-2 py-1 text-[12.5px] ${subActive(g.href) ? "font-medium text-[var(--brand)]" : "text-muted hover:text-fg"}`}>
                            {g.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link key={c.href} href={c.href} onClick={() => setOpen(false)}
                    className={`truncate rounded-md px-2 py-1.5 text-[13px] ${subActive(c.href) ? "font-medium text-[var(--brand)]" : "text-muted hover:text-fg"}`}>
                    {c.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
  // User-made pages, nested like Notion. A page is open while it or a page inside it is showing.
  const currentPage = path.startsWith("/pages/") ? path.split("/")[2] : null;
  const ancestors = new Set<string>();
  for (let cur = pages?.find((p) => p.id === currentPage); cur?.parent_id; cur = pages?.find((p) => p.id === cur!.parent_id)) ancestors.add(cur.parent_id);
  const pageOpen = (id: string) => expanded[`page:${id}`] ?? ancestors.has(id);
  const pageTree = (parent: string | null, depth: number): React.ReactNode =>
    (pages ?? []).filter((p) => p.parent_id === parent).map((p) => {
      const kids = (pages ?? []).some((x) => x.parent_id === p.id);
      return (
        <div key={p.id}>
          <div style={{ paddingLeft: depth * 12 }}
            className={`flex items-center rounded-md ${currentPage === p.id ? "bg-[var(--info-bg)] text-[var(--brand)]" : "text-muted hover:bg-[var(--neutral-bg)] hover:text-fg"}`}>
            <button type="button" aria-label={pageOpen(p.id) ? "Collapse" : "Expand"} onClick={() => setExpanded({ ...expanded, [`page:${p.id}`]: !pageOpen(p.id) })}
              className={`rounded p-1 ${kids ? "" : "invisible"}`}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true" className={`transition-transform ${pageOpen(p.id) ? "rotate-90" : ""}`}><path d="m9 6 6 6-6 6" /></svg>
            </button>
            <Link href={`/pages/${p.id}`} onClick={() => setOpen(false)} className="flex-1 truncate py-1.5 pr-2 text-[13px]">{p.icon ?? "📄"} {p.title}</Link>
          </div>
          {kids && pageOpen(p.id) && pageTree(p.id, depth + 1)}
        </div>
      );
    });
  const pagesNav = pages && (
    <div>
      <div className="mb-1 mt-4 flex items-center justify-between px-3 text-xs font-medium uppercase tracking-wide text-muted">
        <Link href="/pages" className="hover:text-fg">Pages</Link>
        <form action={createPage}><button title="New page" className="rounded px-1.5 text-base leading-none hover:bg-[var(--neutral-bg)] hover:text-fg">+</button></form>
      </div>
      {pages.length ? pageTree(null, 0) : <form action={createPage}><button className="px-3 py-1.5 text-[13px] text-muted hover:text-fg">+ New page</button></form>}
    </div>
  );
  const footer = (
    <div className="border-t border-line pt-4 text-sm">
      <div className="font-medium">{name}</div>
      <div className="mb-3 text-muted">{roleLabel}</div>
      <form action={signOut}><button className="btn btn-sm w-full justify-center">Sign out</button></form>
    </div>
  );

  return (
    <>
      {/* Phone: top bar with menu button */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <Link href="/" className="font-semibold tracking-tight">Beacon Operations</Link>
        <button className="btn btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}</button>
      </header>
      {open && (
        <div className="fixed inset-0 z-10 bg-black/30 md:hidden" onClick={() => setOpen(false)}>
          <div className="flex h-full w-72 flex-col justify-between overflow-y-auto bg-surface p-4 pt-16" onClick={(e) => e.stopPropagation()}>
            <div>{nav}{pagesNav}</div>{footer}
          </div>
        </div>
      )}
      {/* Desktop: fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between border-r border-line bg-surface p-4 md:flex">
        <div className="-mr-2 overflow-y-auto pr-2">
          <Link href="/" className="mb-6 block px-3 pt-1 text-lg font-semibold tracking-tight">Beacon Operations</Link>
          {nav}
          {pagesNav}
        </div>
        {footer}
      </aside>
    </>
  );
}
