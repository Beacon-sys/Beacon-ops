import { signIn, signUp } from "./actions";

export default async function Login({ searchParams }: {
  searchParams: Promise<{ mode?: string; error?: string; notice?: string }>;
}) {
  const { mode, error, notice } = await searchParams;
  const signup = mode === "signup";
  return (
    <div className="mx-auto mt-12 max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Beacon Operations</h1>
      <p className="mt-1 text-sm text-muted">
        {signup ? "Create your account with the email Beacon has on file for you." : "Sign in to continue."}
      </p>
      {error && <p className="mt-4 rounded-lg bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad)]">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-[var(--info-bg)] px-3 py-2 text-sm text-[var(--info)]">{notice}</p>}
      <form action={signup ? signUp : signIn} className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Email</span>
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Password</span>
          <input name="password" type="password" required minLength={8}
            autoComplete={signup ? "new-password" : "current-password"} className="input" />
        </label>
        <button className="btn btn-primary mt-2 justify-center">{signup ? "Create account" : "Sign in"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {signup
          ? <>Already have an account? <a className="link" href="/login">Sign in</a></>
          : <>First time here? <a className="link" href="/login?mode=signup">Create your account</a></>}
      </p>
    </div>
  );
}
