import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askAssistant, type ChatTurn } from "@/lib/assistant";
import { claudeConfigured } from "@/lib/claude";
import { INTERNAL, type Me } from "@/lib/data";

const ALLOWED = [...INTERNAL, "client", "consultant"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { data: me } = await supabase
    .from("people").select("id,name,email,role").eq("user_id", user.id).maybeSingle();
  if (!me || !ALLOWED.includes(me.role)) {
    return NextResponse.json({ error: "Your account doesn't have access to the assistant." }, { status: 403 });
  }
  if (!claudeConfigured()) {
    return NextResponse.json({ error: "The assistant isn't set up yet: the ANTHROPIC_API_KEY secret is missing." }, { status: 503 });
  }

  const body = await req.json().catch(() => null) as { question?: unknown; history?: unknown; page?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 4000) : "";
  if (!question) return NextResponse.json({ error: "Empty question." }, { status: 400 });
  const history: ChatTurn[] = (Array.isArray(body?.history) ? body.history : [])
    .filter((t): t is ChatTurn =>
      !!t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string" && t.text.length > 0)
    .slice(-20)
    .map((t) => ({ role: t.role, text: t.text.slice(0, 8000) }));
  // The conversation must start with a user turn.
  while (history.length && history[0].role !== "user") history.shift();
  const page = typeof body?.page === "string" ? body.page.slice(0, 200) : undefined;

  try {
    const answer = await askAssistant(supabase, me as Me, history, question, page);
    return NextResponse.json({ answer });
  } catch (e) {
    console.error("assistant error", e);
    const msg = e instanceof Anthropic.RateLimitError
      ? "The assistant is busy right now. Please try again in a minute."
      : e instanceof Anthropic.AuthenticationError
        ? "The assistant's API key was rejected. Check the ANTHROPIC_API_KEY secret."
        : e instanceof Anthropic.APIError
          ? `The assistant hit an error (${e.status ?? "network"}). Please try again.`
          : "Something went wrong. Please try again.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
