// Translates user-entered text (work items, tasks, notes...) to Arabic with Claude.
// Each text is translated once and kept in the content_translations table.
import Anthropic from "@anthropic-ai/sdk";
import type { createClient } from "@/lib/supabase/server";

type DB = Awaited<ReturnType<typeof createClient>>;

const MODEL = "claude-opus-5-5";
const SYSTEM = `You translate text from a construction company's operations app (Beacon, Egypt) into Modern Standard Arabic as used by Egyptian contractors and engineers.
The texts are work item / BOQ descriptions, site tasks, purchase requests, meeting titles and notes.
Rules:
- Use standard Arabic construction terminology (e.g. "plastering" -> "محارة", "BOQ" -> "المقايسة").
- Keep numbers, units (m2, m3, kg, mm), codes, brand names, model numbers and people's or company names as written.
- If a text is already Arabic, return it unchanged.
- Return exactly one translation per input, in the same order, with nothing added.`;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const translationEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const FORMAT = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: { translations: { type: "array", items: { type: "string" } } },
    required: ["translations"],
    additionalProperties: false,
  },
};

async function askClaude(texts: string[]): Promise<string[] | null> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });
  const request = {
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "low" as const, format: FORMAT },
    system: SYSTEM,
    messages: [{ role: "user" as const, content: JSON.stringify({ texts }) }],
  };
  let res;
  try {
    // If a safety check declines the request, the API retries it on a fallback model.
    res = await client.beta.messages.create({ ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  } catch (e) {
    if (!(e instanceof Anthropic.BadRequestError)) throw e;
    res = await client.beta.messages.create(request);
  }
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  const out = (JSON.parse(block.text) as { translations: string[] }).translations;
  return Array.isArray(out) && out.length === texts.length ? out : null;
}

/** Arabic for each text, keyed by the original. Texts with no translation are left out. */
export async function translateToArabic(supabase: DB, input: (string | null | undefined)[]): Promise<Record<string, string>> {
  const texts = [...new Set(input.filter((x): x is string => !!x && /[A-Za-z]/.test(x) && x.length <= 4000))].slice(0, 300);
  if (!texts.length) return {};
  const hashes = await Promise.all(texts.map(sha256));
  const byHash = new Map(hashes.map((h, i) => [h, texts[i]]));
  const out: Record<string, string> = {};

  for (let i = 0; i < hashes.length; i += 100) {
    const { data } = await supabase.from("content_translations").select("source_hash,translated")
      .eq("lang", "ar").in("source_hash", hashes.slice(i, i + 100));
    for (const r of data ?? []) out[byHash.get(r.source_hash)!] = r.translated;
  }

  const missing = texts.filter((t) => !(t in out));
  if (!missing.length || !translationEnabled()) return out;
  // Batches small enough to keep each answer quick.
  const batches: string[][] = [];
  for (let i = 0, size = 0; i < missing.length; i++) {
    if (!batches.length || batches[batches.length - 1].length >= 60 || size > 12000) { batches.push([]); size = 0; }
    batches[batches.length - 1].push(missing[i]); size += missing[i].length;
  }
  const results = await Promise.all(batches.map((b) => askClaude(b).catch((e) => { console.error("translate", e); return null; })));
  const rows: { lang: string; source_hash: string; source_text: string; translated: string }[] = [];
  results.forEach((res, bi) => res?.forEach((tr, j) => {
    const src = batches[bi][j];
    if (!tr) return;
    out[src] = tr;
    rows.push({ lang: "ar", source_hash: hashes[texts.indexOf(src)], source_text: src, translated: tr });
  }));
  if (rows.length) {
    const { error } = await supabase.from("content_translations").upsert(rows, { onConflict: "lang,source_hash", ignoreDuplicates: true });
    if (error) console.error("translate cache", error.message);
  }
  return out;
}
