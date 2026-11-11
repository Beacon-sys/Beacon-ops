// Interface language. Strings are written in English in the code and looked up
// in the Arabic dictionary (ar.ts) when the person has chosen Arabic.
import { AR } from "./ar";

export type Lang = "en" | "ar";
export const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
];
export const LANG_COOKIE = "lang";
export const isLang = (v: unknown): v is Lang => v === "en" || v === "ar";
export const dirOf = (l: Lang) => (l === "ar" ? "rtl" : "ltr");
/** Locale for dates and numbers. Arabic keeps Latin digits, as used on Egyptian drawings and BOQs. */
export const localeOf = (l: Lang) => (l === "ar" ? "ar-EG-u-nu-latn" : "en-GB");

export type Vars = Record<string, string | number>;
export type TFn = (s: string, vars?: Vars) => string;

/** Translate an English interface string. `{name}` placeholders are filled from vars. */
export function translate(lang: Lang, s: string, vars?: Vars): string {
  let out = lang === "ar" ? AR[s] ?? AR[s.trim()] ?? s : s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export const makeT = (lang: Lang): TFn => (s, vars) => translate(lang, s, vars);
