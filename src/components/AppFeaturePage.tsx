import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import AppShell, { type AppNavId } from "./AppShell";
import { api } from "../lib/api";
import { waitForClerkToken } from "../lib/clerk";
import { go } from "../lib/nav";
import { tw } from "../lib/tw";
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
      <main
        ref={mainRef}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain scroll-smooth bg-[var(--surface)] [-webkit-overflow-scrolling:touch]"
      >
        <div className="sticky top-0 z-[6] border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur-[10px]">
          <header className="mx-auto flex w-full max-w-[1090px] flex-wrap items-start justify-between gap-3 px-4 py-3.5 md:gap-5 md:px-6 md:py-[18px]">
            <div className="min-w-0 flex-1 basis-[220px]">
              <h1 className="m-0 text-lg font-bold tracking-tight text-[var(--foreground)] md:text-xl">{title}</h1>
              {subtitle ? (
                <p className="mt-1 max-w-[52ch] text-[13px] font-normal leading-[1.45] text-[var(--foreground-muted)]">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center justify-start gap-2 self-start pt-px md:justify-end">{actions}</div>
            ) : null}
          </header>
          {tabs ? <div className="mx-auto w-full max-w-[1090px] px-4 md:px-6">{tabs}</div> : null}
        </div>
        <div className="mx-auto w-full max-w-[1090px] px-4 py-5 pb-10 md:px-6 md:py-7 md:pb-14">{children}</div>
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
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-7 text-center shadow-none md:px-6 md:py-10">
      {mockup ? (
        <div className="mb-6 w-full max-w-sm">{mockup}</div>
      ) : icon ? (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--foreground-muted)]">
          {icon}
        </div>
      ) : null}
      <h2 className="text-[15px] font-semibold text-[var(--foreground)]">{title}</h2>
      <p className={`${tw.muted} mt-2 max-w-[380px]`}>{body}</p>
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
