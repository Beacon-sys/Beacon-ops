import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { LABELS, type Role } from "@/lib/data";
import { signOut } from "./login/actions";

export const metadata: Metadata = {
  title: "Beacon Operations",
  description: "Projects, purchasing and site tasks for Beacon",
};

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: "/", label: "Overview", roles: ["management", "site_ops", "procurement", "accountant", "client", "consultant"] },
  { href: "/projects", label: "Projects", roles: ["management", "site_ops", "procurement", "accountant", "client", "consultant"] },
  { href: "/site-tasks", label: "Site tasks", roles: ["management", "site_ops"] },
  { href: "/purchasing", label: "Purchasing", roles: ["management", "site_ops", "procurement", "accountant"] },
  { href: "/people", label: "People", roles: ["management", "procurement"] },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user
    ? (await supabase.from("people").select("name,role").eq("user_id", user.id).maybeSingle()).data
    : null;
  const role = me?.role as Role | undefined;

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {user && (
          <header className="border-b border-line bg-surface">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <Link href="/" className="font-semibold tracking-tight">Beacon Operations</Link>
              <nav className="flex flex-wrap gap-4 text-sm">
                {role && NAV.filter((n) => n.roles.includes(role)).map((n) => (
                  <Link key={n.href} href={n.href} className="text-muted hover:text-fg">{n.label}</Link>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-3 text-sm">
                <span className="text-muted">
                  {me?.name ?? user.email}{role ? ` · ${LABELS.role[role]}` : ""}
                </span>
                <form action={signOut}><button className="btn btn-sm">Sign out</button></form>
              </div>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
