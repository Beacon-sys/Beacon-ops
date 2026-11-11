"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export async function signIn(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get("email")).trim().toLowerCase(),
    password: String(fd.get("password")),
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  // Use the language saved on the person's profile.
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("people").select("language").eq("user_id", user.id).maybeSingle() : { data: null };
  if (me?.language) (await cookies()).set(LANG_COOKIE, me.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect("/");
}

export async function signUp(fd: FormData) {
  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const { data, error } = await supabase.auth.signUp({
    email: String(fd.get("email")).trim().toLowerCase(),
    password: String(fd.get("password")),
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  if (!data.session) redirect("/login?notice=confirm");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
