export function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="mb-4 rounded-lg bg-[var(--bad-bg)] px-4 py-3 text-sm text-[var(--bad)]">
      Couldn&apos;t save: {error}
    </p>
  );
}
