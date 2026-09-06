import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import Landing from "./pages/Landing";
import RequireVerified from "./components/RequireVerified";
import { GUIDE_PAGES, TOOL_PAGES } from "./content/marketing";
import { SEO_PATHS } from "./content/seo-pages";
import { BLOG_POSTS } from "./content/blog";

const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Setup = lazy(() => import("./pages/Setup"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Settings = lazy(() => import("./pages/Settings"));
const Legal = lazy(() => import("./pages/Legal"));
const InviteAccept = lazy(() => import("./pages/InviteAccept"));
const SeoLanding = lazy(() => import("./pages/SeoLanding"));
const DnsToolPage = lazy(() => import("./pages/DnsToolPage"));
const CalculatorPage = lazy(() => import("./pages/CalculatorPage"));
const ToolsIndex = lazy(() => import("./pages/ToolsIndex"));
const GuidePage = lazy(() => import("./pages/GuidePage"));
const BlogIndex = lazy(() => import("./pages/BlogIndex"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const DocsApiPage = lazy(() => import("./pages/DocsApiPage"));

function Screen({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="auth-shell"><p className="muted">Loading Flap…</p></div>}>{children}</Suspense>;
}

const SEO_PATH_SET = new Set<string>(SEO_PATHS);

const DNS_TOOL_PATHS = new Set<string>(
  TOOL_PAGES.filter(
    (t) =>
      t.path !== "/tools/google-workspace-cost-calculator" &&
      t.path !== "/tools/flap-vs-workspace-share",
  ).map((t) => t.path),
);

const GUIDE_PATHS = new Set<string>(GUIDE_PAGES.map((g) => g.path));
const BLOG_PATHS = new Set<string>(BLOG_POSTS.map((p) => p.path));

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (path === "/setup") return <Screen><Setup /></Screen>;
  if (path === "/signup") return <Screen><Signup /></Screen>;
  if (path === "/login") return <Screen><Login /></Screen>;
  if (path === "/forgot-password" || path === "/reset-password") {
    return <Screen><Login /></Screen>;
  }
  if (path === "/verify-email") return <Screen><VerifyEmail /></Screen>;
  if (path.startsWith("/invite/")) return <Screen><InviteAccept /></Screen>;
  if (path === "/terms") return <Screen><Legal doc="terms" /></Screen>;
  if (path === "/privacy") return <Screen><Legal doc="privacy" /></Screen>;
  if (path === "/billing-terms") return <Screen><Legal doc="billing" /></Screen>;
  if (path === "/app/settings" || path === "/settings/referrals") {
    return (
      <Screen>
        <RequireVerified>
          <Settings />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app/compose") {
    return (
      <Screen>
        <RequireVerified>
          <Inbox composeOpen />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app" || path.startsWith("/app/")) {
    return (
      <Screen>
        <RequireVerified>
          <Inbox />
        </RequireVerified>
      </Screen>
    );
  }

  if (path === "/docs/api") {
    return <Screen><DocsApiPage /></Screen>;
  }
  if (path === "/tools") {
    return <Screen><ToolsIndex /></Screen>;
  }
  if (path === "/tools/google-workspace-cost-calculator") {
    return <Screen><CalculatorPage /></Screen>;
  }
  if (path === "/tools/flap-vs-workspace-share") {
    return <Screen><CalculatorPage share /></Screen>;
  }
  if (DNS_TOOL_PATHS.has(path)) {
    return <Screen><DnsToolPage path={path} /></Screen>;
  }
  if (GUIDE_PATHS.has(path)) {
    return <Screen><GuidePage path={path} /></Screen>;
  }
  if (path === "/blog") {
    return <Screen><BlogIndex /></Screen>;
  }
  if (BLOG_PATHS.has(path)) {
    return <Screen><BlogPost path={path} /></Screen>;
  }
  if (SEO_PATH_SET.has(path)) {
    return <Screen><SeoLanding path={path} /></Screen>;
  }

  return <Landing />;
}
