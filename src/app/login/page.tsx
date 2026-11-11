import { signIn, signUp } from "./actions";
import { T } from "@/components/i18n";

export default async function Login({ searchParams }: {
  searchParams: Promise<{ mode?: string; error?: string; notice?: string }>;
}) {
  const { mode, error, notice } = await searchParams;
  const signup = mode === "signup";
  return (
    <div className="mx-auto mt-12 max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight"><T>{"Beacon Operations"}</T></h1>
      <p className="mt-1 text-sm text-muted">
        <T>{signup ? "Create your account with the email Beacon has on file for you." : "Sign in to continue."}</T>
      </p>
      {error && <p className="mt-4 rounded-lg bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad)]">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-[var(--info-bg)] px-3 py-2 text-sm text-[var(--info)]"><T>{notice === "confirm" ? "Check your email to confirm your account, then sign in." : notice}</T></p>}
      <form action={signup ? signUp : signIn} className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted"><T>{"Email"}</T></span>
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted"><T>{"Password"}</T></span>
          <input name="password" type="password" required minLength={8}
            autoComplete={signup ? "new-password" : "current-password"} className="input" />
        </label>
        <button className="btn btn-primary mt-2 justify-center"><T>{signup ? "Create account" : "Sign in"}</T></button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {signup
          ? <><T>{"Already have an account?"}</T> <a className="link" href="/login"><T>{"Sign in"}</T></a></>
          : <><T>{"First time here?"}</T> <a className="link" href="/login?mode=signup"><T>{"Create your account"}</T></a></>}
      </p>
    </div>
  );
}
