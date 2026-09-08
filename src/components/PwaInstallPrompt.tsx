import { useEffect, useState } from "react";
import { Button } from "./ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaInstallPrompt({ ready }: { ready: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("flap-pwa-dismiss") === "1");

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!ready || dismissed || !deferred) return null;

  return (
    <div className="mail-toast" role="status" aria-live="polite">
      <div>
        <strong>Install Flap</strong>
        <span>Faster triage on your phone.</span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          await deferred.prompt();
          setDeferred(null);
        }}
      >
        Install
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="mail-toast-close h-8 w-8"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem("flap-pwa-dismiss", "1");
          setDismissed(true);
        }}
      >
        ×
      </Button>
    </div>
  );
}
