import { useEffect, useState, type ReactNode } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import AppShell, { type AppNavId } from "../components/AppShell";
import { api } from "../lib/api";
import { go } from "../lib/nav";
import { Button } from "../components/ui/button";

/** Shared authenticated shell for non-inbox app surfaces. */
export default function AppFeaturePage({
  current,
  title,
  subtitle,
  children,
  actions,
}: {
  current: AppNavId;
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      go("/login");
      return;
    }
    api
      .me()
      .then((me) => setEmail(me.user.email))
      .catch(() => go("/login"));
  }, [isLoaded, isSignedIn]);

  async function onLogout() {
    try {
      await clerk.signOut({ redirectUrl: "/" });
    } catch {
      go("/");
    }
  }

  return (
    <AppShell email={email || "…"} current={current} onLogout={() => void onLogout()}>
      <main className="settings app-feature">
        <header className="app-feature-head">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          {actions ? <div className="app-feature-actions">{actions}</div> : null}
        </header>
        <div className="app-feature-body">{children}</div>
      </main>
    </AppShell>
  );
}

export function FeatureEmpty({
  title,
  body,
  cta,
  onCta,
}: {
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className="app-feature-empty">
      <h2>{title}</h2>
      <p className="muted">{body}</p>
      {cta && onCta ? (
        <Button className="mt-4" type="button" onClick={onCta}>
          {cta}
        </Button>
      ) : null}
    </div>
  );
}
