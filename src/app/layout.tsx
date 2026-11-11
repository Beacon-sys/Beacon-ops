import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { LABELS, INTERNAL, type Role } from "@/lib/data";
import { signOut } from "./login/actions";
import { Sidebar } from "@/components/sidebar";
import { LangProvider } from "@/components/i18n";
import { LanguageSwitch } from "@/components/language-switch";
import { dirOf, makeT } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Beacon Operations",
  description: "Projects, purchasing and site tasks for Beacon",
};

type Sub = { href: string; label: string; roles?: Role[] };
const NAV: { href: string; label: string; icon: string; roles: Role[]; group?: string; children?: Sub[] }[] = [
  { href: "/", label: "My projects", icon: "home", roles: ["client", "consultant"] },
  { href: "/actions-tracker", label: "Action tracker", icon: "check", roles: ["client", "consultant"] },
  { href: "/management", label: "Management", icon: "home", roles: ["management"], group: "Departments", children: [
    { href: "/management", label: "Overview" },
    { href: "/projects/new", label: "New project" },
    { href: "/people", label: "People & roles" },
  ] },
  { href: "/tendering", label: "Tendering", icon: "doc", roles: ["management", "tendering"], group: "Departments", children: [
    { href: "/tendering", label: "Open tenders" },
    { href: "/projects/new", label: "New tender" },
    { href: "/tendering#won", label: "Won tenders" },
    { href: "/people", label: "Clients & consultants", roles: ["tendering"] },
  ] },
  { href: "/accounting", label: "Accounting", icon: "coins", roles: ["management", "accountant"], group: "Departments", children: [
    { href: "/accounting", label: "To pay" },
    { href: "/accounting#finances", label: "Project finances" },
  ] },
  { href: "/operations", label: "Operations", icon: "check", roles: ["management", "site_ops"], group: "Departments", children: [
    { href: "/operations?view=mine", label: "My tasks" },
    { href: "/operations?view=open", label: "All open tasks" },
    { href: "/operations?view=all", label: "Task history" },
    { href: "/submittals", label: "Submittals" },
    { href: "/actions-tracker", label: "Client & consultant actions" },
    { href: "/operations#request", label: "Request materials" },
  ] },
  { href: "/procurement", label: "Procurement", icon: "cart", roles: ["management", "procurement"], group: "Departments", children: [
    { href: "/procurement?view=open", label: "Open requests" },
    { href: "/procurement?view=approval", label: "Needs approval" },
    { href: "/procurement?view=all", label: "All purchases" },
    { href: "/procurement/contracts", label: "Contracts" },
    { href: "/procurement/vendors", label: "Vendors & contractors" },
  ] },
  { href: "/submittals", label: "Submittals", icon: "doc", roles: ["management", "tendering", "site_ops", "procurement", "client", "consultant"], group: "Records" },
  { href: "/projects", label: "All projects", icon: "folder", roles: ["management", "tendering", "site_ops", "procurement", "accountant"], group: "Records" },
  { href: "/people", label: "People", icon: "people", roles: ["management", "tendering"], group: "Records" },
];

// Sub-pages listed under each project in the sidebar.
const projectPages = (id: string, internal: boolean) => [
  { href: `/projects/${id}`, label: "Overview" },
  { href: `/projects/${id}/work-items`, label: "Work items" },
  ...(internal ? [
    { href: `/projects/${id}/tasks`, label: "Site tasks" },
    { href: `/projects/${id}/meetings`, label: "Meetings" },
    { href: `/projects/${id}/purchasing`, label: "Purchasing" },
  ] : []),
  { href: `/submittals?project=${id}`, label: "Submittals" },
  { href: `/projects/${id}/timeline`, label: "Timeline" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user
    ? (await supabase.from("people").select("name,role").eq("user_id", user.id).maybeSingle()).data
    : null;
  // Kept in a cookie by the middleware from the person's profile (people.language).
  const lang = await getLang();
  const t = makeT(lang);
  const role = me?.role as Role | undefined;
  // Projects listed under "All projects" / "My projects" (row-level security limits what each person sees).
  const projects = role
    ? (await supabase.from("projects").select("id,name,status").neq("status", "closed").order("name").limit(20)).data ?? []
    : [];
  const pages = role && INTERNAL.includes(role)
    ? (await supabase.from("pages").select("id,parent_id,title,icon").order("position")).data ?? []
    : undefined;

  return (
    <html lang={lang} dir={dirOf(lang)}>
      <body className="min-h-screen antialiased">
        <LangProvider lang={lang}>
        {user ? (
          <>
            <Suspense>
            <Sidebar
              items={role ? NAV.filter((n) => n.roles.includes(role)).map(({ href, label, icon, group, children }) => ({
                href, label: t(label), icon, group: group && t(group),
                children: href === "/projects" || href === "/"
                  ? projects.map((p) => ({ href: `/projects/${p.id}`, label: p.name,
                      children: projectPages(p.id, INTERNAL.includes(role)).map((x) => ({ ...x, label: t(x.label) })) }))
                  : children?.filter((c) => !c.roles || c.roles.includes(role)).map(({ href, label }) => ({ href, label: t(label) })),
              })) : []}
              name={me?.name ?? user.email ?? ""}
              roleLabel={role ? t(LABELS.role[role]) : ""}
              signOut={signOut}
              pages={pages}
            />
            </Suspense>
            <main className="px-4 py-8 md:ms-60 md:px-8">
              <div className="mx-auto max-w-6xl has-[.full-bleed]:max-w-none">{children}</div>
            </main>
          </>
        ) : (
          <main className="mx-auto max-w-6xl px-4 py-8">
            <div className="flex justify-end"><LanguageSwitch className="w-44" /></div>
            {children}
          </main>
        )}
        </LangProvider>
      </body>
    </html>
  );
}
