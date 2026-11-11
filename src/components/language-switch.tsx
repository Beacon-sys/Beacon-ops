"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGS } from "@/lib/i18n";
import { setLanguage } from "@/app/i18n-actions";
import { useLang, useT } from "./i18n";

/** English / العربية toggle, saved per person. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={t("Language")} className={`flex rounded-lg border border-line p-0.5 text-xs ${pending ? "opacity-60" : ""} ${className}`}>
      {LANGS.map((l) => (
        <button key={l.value} type="button" lang={l.value} aria-pressed={lang === l.value} disabled={pending}
          onClick={() => lang !== l.value && start(async () => { await setLanguage(l.value); router.refresh(); })}
          className={`flex-1 rounded-md px-2 py-1 ${lang === l.value ? "bg-[var(--info-bg)] font-medium text-[var(--brand)]" : "text-muted hover:text-fg"}`}>
          {l.label}
        </button>
      ))}
    </div>
  );
}
