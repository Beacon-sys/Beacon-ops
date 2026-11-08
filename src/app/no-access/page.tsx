import { signOut } from "../login/actions";

export default function NoAccess() {
  return (
    <div className="mx-auto mt-12 max-w-md text-center">
      <h1 className="text-xl font-semibold">Your account isn&apos;t set up yet</h1>
      <p className="mt-2 text-sm text-muted">
        You&apos;re signed in, but Beacon hasn&apos;t added your email to the system yet.
        Ask Beacon management to add you, then sign in again.
      </p>
      <form action={signOut} className="mt-6"><button className="btn">Sign out</button></form>
    </div>
  );
}
