import Anthropic from "@anthropic-ai/sdk";

// Shared Claude API setup for the whole app (assistant, translation, ...).
// The key is a Cloudflare Worker secret named ANTHROPIC_API_KEY (see README).
export const CLAUDE_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;

export const claudeConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export function getClaude() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic({ apiKey });
  return client;
}
