"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = { href: string; label: string; icon: string; group?: string };

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  folder: <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />,
  check: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m8 12 3 3 5-6" /></>,
  cart: <><path d="M3 4h2l2.5 11h11L21 7H6.2" /><circle cx="9" cy="19.5" r="1.3" /><circle cx="18" cy="19.5" r="1.3" /></>,
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
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((n, i) => (<div key={n.href}>
        {n.group && n.group !== items[i - 1]?.group && (
          <div className="mb-1 mt-4 px-3 text-xs font-medium uppercase tracking-wide text-muted first:mt-0">{n.group}</div>
        )}
        <Link href={n.href} onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${active(n.href) ? "bg-[var(--info-bg)] font-medium text-[var(--brand)]" : "text-muted hover:bg-[var(--neutral-bg)] hover:text-fg"}`}>
          <Icon name={n.icon} />{n.label}
        </Link>
      </div>))}
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
          <div className="flex h-full w-64 flex-col justify-between bg-surface p-4 pt-16" onClick={(e) => e.stopPropagation()}>
            {nav}{footer}
          </div>
        </div>
      )}
      {/* Desktop: fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between border-r border-line bg-surface p-4 md:flex">
        <div>
          <Link href="/" className="mb-6 block px-3 pt-1 text-lg font-semibold tracking-tight">Beacon Operations</Link>
          {nav}
        </div>
        {footer}
      </aside>
    </>
  );
}
