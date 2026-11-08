"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

export type SubItem = { href: string; label: string };
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

export function Sidebar({ items, name, roleLabel, signOut }: {
  items: NavItem[]; name: string; roleLabel: string; signOut: () => Promise<void>;
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

  // A sub-link is current when its path and any ?view= match the page.
  const subActive = (href: string) => {
    const [base, query] = href.split("#")[0].split("?");
    if (base !== path) return false;
    const want = new URLSearchParams(query ?? "").get("view");
    return want ? search.get("view") === want : !href.includes("#") && !search.get("view");
  };

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
                {kids.map((c) => (
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
            {nav}{footer}
          </div>
        </div>
      )}
      {/* Desktop: fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between border-r border-line bg-surface p-4 md:flex">
        <div className="-mr-2 overflow-y-auto pr-2">
          <Link href="/" className="mb-6 block px-3 pt-1 text-lg font-semibold tracking-tight">Beacon Operations</Link>
          {nav}
        </div>
        {footer}
      </aside>
    </>
  );
}
