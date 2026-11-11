"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { makeT, type Lang, type Vars } from "@/lib/i18n";
import { translateContent } from "@/app/i18n-actions";

const LangContext = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
export const useT = () => { const lang = useLang(); return useMemo(() => makeT(lang), [lang]); };

/** Translated interface text, for use inside server components too: <T>Save</T>. */
export function T({ children, vars }: { children: string; vars?: Vars }) {
  return <>{useT()(children, vars)}</>;
}

// ---- user-entered content (work item names, notes...) translated by Claude

const memory = new Map<string, string>();
const STORE = "tr:ar:";
const hasLatin = (s: string) => /[A-Za-z]/.test(s);
const remembered = (s: string) => {
  if (memory.has(s)) return memory.get(s);
  try { const v = sessionStorage.getItem(STORE + s); if (v !== null) { memory.set(s, v); return v; } } catch {}
  return undefined;
};

/**
 * Arabic versions of the given texts when the interface is in Arabic.
 * Returns a lookup that falls back to the original text while a translation is loading
 * or when no translation is available. Translations are cached in the database.
 */
export function useContentTranslation(texts: (string | null | undefined)[]) {
  const lang = useLang();
  const [, bump] = useState(0);
  const wanted = useMemo(
    () => (lang === "ar" ? [...new Set(texts.filter((x): x is string => !!x && hasLatin(x)))] : []),
    [lang, texts.join("\u0001")], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    const missing = wanted.filter((s) => remembered(s) === undefined);
    if (!missing.length) return;
    let live = true;
    (async () => {
      for (let i = 0; i < missing.length; i += 150) {
        const got = await translateContent(missing.slice(i, i + 150)).catch(() => ({} as Record<string, string>));
        for (const [k, v] of Object.entries(got)) {
          memory.set(k, v);
          try { sessionStorage.setItem(STORE + k, v); } catch {}
        }
        if (live) bump((n) => n + 1);
      }
    })();
    return () => { live = false; };
  }, [wanted]);
  return (s: string) => (lang === "ar" ? remembered(s) ?? s : s);
}

/** <option> elements with translated labels (options must have plain text children). */
export function TOptions({ options }: { options: [value: string, label: string][] }) {
  const t = useT();
  return <>{options.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</>;
}

/** One <option> with a translated label. */
export function TOption({ label, ...props }: { label: string } & React.OptionHTMLAttributes<HTMLOptionElement>) {
  return <option {...props}>{useT()(label)}</option>;
}
