import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/ThemeProvider";
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
      <App />
    </ThemeProvider>
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
