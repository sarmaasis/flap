import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import AppShell, { type AppNavId } from "./AppShell";
import { api } from "../lib/api";
import { waitForClerkToken } from "../lib/clerk";
import { go } from "../lib/nav";
import { Button } from "./ui/button";

/** Shared authenticated shell for non-inbox app surfaces. */
export default function AppFeaturePage({
  current,
  title,
  subtitle,
  children,
  actions,
  tabs,
}: {
  current: AppNavId;
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Optional underline tab strip rendered under the page header. */
  tabs?: ReactNode;
}) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const clerk = useClerk();
  const [email, setEmail] = useState("");
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      go("/login");
      return;
    }
    let cancelled = false;
    void (async () => {
      await waitForClerkToken(() => getToken());
      if (cancelled) return;
      try {
        const me = await api.me();
        if (!cancelled) setEmail(me.user.email);
      } catch {
        if (!cancelled) go("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, [current, title]);

  async function onLogout() {
    try {
      await clerk.signOut({ redirectUrl: "/" });
    } catch {
      go("/");
    }
  }

  return (
    <AppShell email={email || "…"} current={current} onLogout={() => void onLogout()}>
      <main ref={mainRef} className="settings app-feature scroll-smooth">
        <div className="app-feature-top">
          <header className="app-feature-head">
            <div className="app-feature-titles">
              <h1>{title}</h1>
              {subtitle ? <p className="app-feature-subtitle">{subtitle}</p> : null}
            </div>
            {actions ? <div className="app-feature-actions">{actions}</div> : null}
          </header>
          {tabs ? <div className="app-feature-tabs">{tabs}</div> : null}
        </div>
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
  mockup,
  icon,
  secondaryCta,
  onSecondaryCta,
}: {
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
  mockup?: ReactNode;
  icon?: ReactNode;
  secondaryCta?: string;
  onSecondaryCta?: () => void;
}) {
  return (
    <div className="app-feature-empty flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] px-6 py-10 text-center shadow-none">
      {mockup ? (
        <div className="mb-6 w-full max-w-sm">{mockup}</div>
      ) : icon ? (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--foreground-muted)]">
          {icon}
        </div>
      ) : null}
      <h2 className="text-[15px] font-semibold text-[var(--foreground)]">{title}</h2>
      <p className="muted mt-2 max-w-[380px] text-[13px]">{body}</p>
      {(cta && onCta) || (secondaryCta && onSecondaryCta) ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {cta && onCta ? (
            <Button type="button" onClick={onCta}>
              {cta}
            </Button>
          ) : null}
          {secondaryCta && onSecondaryCta ? (
            <Button type="button" variant="secondary" onClick={onSecondaryCta}>
              {secondaryCta}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
