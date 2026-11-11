import { cookies } from "next/headers";
import { LANG_COOKIE, isLang, makeT, type Lang } from "./index";

/** The signed-in person's language, kept in a cookie (and in people.language). */
export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "en";
}

export async function getT() {
  return makeT(await getLang());
}
