"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; text: string; error?: boolean };

const EXAMPLES = [
  "Which work items are behind schedule?",
  "What purchases are waiting for approval?",
  "Summarise the open site tasks due this week",
];

// Minimal Markdown: **bold**, [links](/path), bullet and numbered lines.
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  return parts.map((p, i) => {
    const bold = p.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const href = link[2];
      return href.startsWith("/")
        ? <Link key={i} href={href} className="text-blue-700 underline">{link[1]}</Link>
        : <a key={i} href={href} target="_blank" rel="noreferrer" className="text-blue-700 underline">{link[1]}</a>;
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

function Answer({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split("\n").map((line, i) => {
        const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
        if (bullet) return <div key={i} className="flex gap-2 ps-1"><span aria-hidden>•</span><span>{inline(bullet[1])}</span></div>;
        if (/^#{1,4}\s/.test(line)) return <div key={i} className="font-semibold">{inline(line.replace(/^#+\s/, ""))}</div>;
        return line.trim() ? <div key={i}>{inline(line)}</div> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

export function AssistantPanel({ ready }: { ready: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, busy, open]);

  async function ask(question: string) {
    question = question.trim();
    if (!question || busy) return;
    const history = turns.filter((t) => !t.error).map(({ role, text }) => ({ role, text }));
    setTurns((t) => [...t, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history, page: path }),
      });
      const data = await res.json().catch(() => ({ error: "Unexpected response from the server." }));
      setTurns((t) => [...t, data.answer
        ? { role: "assistant", text: data.answer }
        : { role: "assistant", text: data.error ?? "Something went wrong.", error: true }]);
    } catch {
      setTurns((t) => [...t, { role: "assistant", text: "Couldn't reach the server. Check your connection.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-4 end-4 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-slate-700">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
          </svg>
          Ask Claude
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="Ask Claude"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[80vh] flex-col border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:end-4 sm:h-[70vh] sm:w-[420px] sm:rounded-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Ask Claude</div>
              <div className="text-xs text-slate-500">Reads the data you can see. It can&apos;t change anything.</div>
            </div>
            <div className="flex gap-1">
              {turns.length > 0 && (
                <button onClick={() => setTurns([])} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">New chat</button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {!ready && (
              <div className="rounded-lg bg-amber-50 p-3 text-amber-800">
                The assistant isn&apos;t switched on yet. An admin needs to add the <code>ANTHROPIC_API_KEY</code> secret in Cloudflare.
              </div>
            )}
            {ready && turns.length === 0 && (
              <div className="space-y-2">
                <p className="text-slate-600">Ask about projects, work items, site tasks, purchasing, contracts or submittals. English or Arabic.</p>
                {EXAMPLES.map((q) => (
                  <button key={q} onClick={() => ask(q)}
                    className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-start text-slate-700 hover:bg-slate-50">{q}</button>
                ))}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
                <div dir="auto" className={
                  t.role === "user" ? "max-w-[85%] whitespace-pre-wrap rounded-lg bg-slate-900 px-3 py-2 text-white"
                    : t.error ? "rounded-lg bg-red-50 px-3 py-2 text-red-700"
                      : "rounded-lg bg-slate-50 px-3 py-2 text-slate-800"}>
                  {t.role === "assistant" && !t.error ? <Answer text={t.text} /> : t.text}
                </div>
              </div>
            ))}
            {busy && <div className="animate-pulse text-slate-500">Looking that up…</div>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 border-t border-slate-200 p-3">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} dir="auto" rows={1}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
              placeholder={ready ? "Ask a question…" : "Not set up yet"} disabled={!ready}
              className="max-h-32 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none" />
            <button type="submit" disabled={!ready || busy || !input.trim()}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Send</button>
          </form>
        </div>
      )}
    </>
  );
}
