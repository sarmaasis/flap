import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/ThemeProvider";
import { FlapClerkProvider } from "./lib/clerk";
import { captureReferralFromUrl, captureUtmFromUrl } from "./lib/seo";
import { trackOnce } from "./lib/analytics";
import "./index.css";

captureReferralFromUrl();
captureUtmFromUrl();

const params = new URLSearchParams(window.location.search);
const isOrganic =
  Boolean(params.get("utm_source") || params.get("utm_medium")) ||
  (typeof document !== "undefined" &&
    Boolean(document.referrer) &&
    !document.referrer.includes("useflap.online") &&
    /google\.|bing\.|duckduckgo\.|yahoo\.|baidu\./i.test(document.referrer));
if (isOrganic) {
  trackOnce("organic_land", "organic_landing", {
    referrer_host: (() => {
      try {
        return document.referrer ? new URL(document.referrer).hostname : "utm";
      } catch {
        return "utm";
      }
    })(),
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <FlapClerkProvider>
        <App />
      </FlapClerkProvider>
    </ThemeProvider>
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  } else {
    // A worker left over from an earlier session answers /src/** and pre-bundled dep
    // requests from its own cache, which replays a module graph the dev server has
    // already re-optimized away. Tear it down instead of registering a new one.
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister();
    });
    if ("caches" in window) {
      void caches.keys().then((keys) => {
        for (const key of keys) void caches.delete(key);
      });
    }
  }
}
