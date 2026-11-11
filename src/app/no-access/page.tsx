import { signOut } from "../login/actions";
import { T } from "@/components/i18n";

export default function NoAccess() {
  return (
    <div className="mx-auto mt-12 max-w-md text-center">
      <h1 className="text-xl font-semibold"><T>{"Your account isn't set up yet"}</T></h1>
      <p className="mt-2 text-sm text-muted">
        <T>{"You're signed in, but Beacon hasn't added your email to the system yet. Ask Beacon management to add you, then sign in again."}</T>
      </p>
      <form action={signOut} className="mt-6"><button className="btn"><T>{"Sign out"}</T></button></form>
    </div>
  );
}
