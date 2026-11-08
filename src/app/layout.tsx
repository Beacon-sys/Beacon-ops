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

const NAV: { href: string; label: string; icon: string; roles: Role[] }[] = [
  { href: "/", label: "Overview", icon: "home", roles: ["management", "site_ops", "procurement", "accountant", "client", "consultant"] },
  { href: "/projects", label: "Projects", icon: "folder", roles: ["management", "site_ops", "procurement", "accountant", "client", "consultant"] },
  { href: "/site-tasks", label: "Site tasks", icon: "check", roles: ["management", "site_ops"] },
  { href: "/purchasing", label: "Purchasing", icon: "cart", roles: ["management", "site_ops", "procurement", "accountant"] },
  { href: "/people", label: "People", icon: "people", roles: ["management", "procurement"] },
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
              items={role ? NAV.filter((n) => n.roles.includes(role)).map(({ href, label, icon }) => ({ href, label, icon })) : []}
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
