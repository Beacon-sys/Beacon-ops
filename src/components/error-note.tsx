import { T } from "@/components/i18n";

export function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="mb-4 rounded-lg bg-[var(--bad-bg)] px-4 py-3 text-sm text-[var(--bad)]">
      <T>{"Couldn't save:"}</T> <T>{error}</T>
    </p>
  );
}
