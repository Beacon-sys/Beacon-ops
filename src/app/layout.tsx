import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { LABELS, type Role } from "@/lib/data";
import { signOut } from "./login/actions";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Beacon Operations",
  description: "Projects, purchasing and site tasks for Beacon",
};

const NAV: { href: string; label: string; icon: string; roles: Role[]; group?: string }[] = [
  { href: "/", label: "My projects", icon: "home", roles: ["client", "consultant"] },
  { href: "/management", label: "Management", icon: "home", roles: ["management"], group: "Departments" },
  { href: "/tendering", label: "Tendering", icon: "doc", roles: ["management", "tendering"], group: "Departments" },
  { href: "/accounting", label: "Accounting", icon: "coins", roles: ["management", "accountant"], group: "Departments" },
  { href: "/operations", label: "Operations", icon: "check", roles: ["management", "site_ops"], group: "Departments" },
  { href: "/procurement", label: "Procurement", icon: "cart", roles: ["management", "procurement"], group: "Departments" },
  { href: "/projects", label: "All projects", icon: "folder", roles: ["management", "tendering", "site_ops", "procurement", "accountant"], group: "Records" },
  { href: "/people", label: "People", icon: "people", roles: ["management", "tendering", "procurement"], group: "Records" },
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
        {user ? (
          <>
            <Sidebar
              items={role ? NAV.filter((n) => n.roles.includes(role)).map(({ href, label, icon, group }) => ({ href, label, icon, group })) : []}
              name={me?.name ?? user.email ?? ""}
              roleLabel={role ? LABELS.role[role] : ""}
              signOut={signOut}
            />
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
