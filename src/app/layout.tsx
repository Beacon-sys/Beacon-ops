import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { LABELS, type Role } from "@/lib/data";
import { signOut } from "./login/actions";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Beacon Operations",
  description: "Projects, purchasing and site tasks for Beacon",
};

type Sub = { href: string; label: string; roles?: Role[] };
const NAV: { href: string; label: string; icon: string; roles: Role[]; group?: string; children?: Sub[] }[] = [
  { href: "/", label: "My projects", icon: "home", roles: ["client", "consultant"] },
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
    { href: "/timeline", label: "Timeline" },
    { href: "/submittals", label: "Submittals" },
    { href: "/operations#request", label: "Request materials" },
  ] },
  { href: "/procurement", label: "Procurement", icon: "cart", roles: ["management", "procurement"], group: "Departments", children: [
    { href: "/procurement?view=open", label: "Open requests" },
    { href: "/procurement?view=approval", label: "Needs approval" },
    { href: "/procurement?view=all", label: "All purchases" },
    { href: "/procurement/vendors", label: "Vendors & contractors" },
  ] },
  { href: "/timeline", label: "Timeline", icon: "chart", roles: ["management", "tendering", "site_ops", "procurement", "accountant", "client", "consultant"], group: "Records" },
  { href: "/submittals", label: "Submittals", icon: "doc", roles: ["management", "tendering", "site_ops", "procurement", "client", "consultant"], group: "Records" },
  { href: "/projects", label: "All projects", icon: "folder", roles: ["management", "tendering", "site_ops", "procurement", "accountant"], group: "Records" },
  { href: "/people", label: "People", icon: "people", roles: ["management", "tendering"], group: "Records" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user
    ? (await supabase.from("people").select("name,role").eq("user_id", user.id).maybeSingle()).data
    : null;
  const role = me?.role as Role | undefined;
  // Projects listed under "All projects" / "My projects" (row-level security limits what each person sees).
  const projects = role
    ? (await supabase.from("projects").select("id,name,status").neq("status", "closed").order("name").limit(20)).data ?? []
    : [];

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {user ? (
          <>
            <Suspense>
            <Sidebar
              items={role ? NAV.filter((n) => n.roles.includes(role)).map(({ href, label, icon, group, children }) => ({
                href, label, icon, group,
                children: href === "/projects" || href === "/"
                  ? projects.map((p) => ({ href: `/projects/${p.id}`, label: p.name }))
                  : children?.filter((c) => !c.roles || c.roles.includes(role)).map(({ href, label }) => ({ href, label })),
              })) : []}
              name={me?.name ?? user.email ?? ""}
              roleLabel={role ? LABELS.role[role] : ""}
              signOut={signOut}
            />
            </Suspense>
            <main className="px-4 py-8 md:ml-60 md:px-8">
              <div className="mx-auto max-w-6xl">{children}</div>
            </main>
          </>
        ) : (
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        )}
      </body>
    </html>
  );
}
