"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LANG_COOKIE, isLang } from "@/lib/i18n";
import { translateToArabic } from "@/lib/translate";

/** Switch the interface language for this person (saved on their profile and in a cookie). */
export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.rpc("set_my_language", { lang });
  revalidatePath("/", "layout");
}

/** Arabic translations of user-entered texts shown in a database grid. */
export async function translateContent(texts: string[]): Promise<Record<string, string>> {
  if (!Array.isArray(texts)) return {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  return translateToArabic(supabase, texts.filter((t) => typeof t === "string").slice(0, 150));
}
