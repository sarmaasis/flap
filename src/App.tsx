import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import RequireVerified from "./components/RequireVerified";
import { SEO_PATHS } from "./content/seo-paths";
import { FOR_PATHS, VS_PATHS } from "./content/hubs";
import { BLOG_PATHS } from "./content/blog-paths";
import { DNS_TOOL_PATHS as DNS_TOOL_PATH_LIST, GUIDE_PATHS as GUIDE_PATH_LIST } from "./content/tool-guide-paths";
import { normalizePathname } from "./content/public-routes";
import { tw } from "./lib/tw";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const SsoCallback = lazy(() => import("./pages/SsoCallback"));
const AuthVerify = lazy(() => import("./pages/AuthVerify"));
const Setup = lazy(() => import("./pages/Setup"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Settings = lazy(() => import("./pages/Settings"));
const DomainsPage = lazy(() => import("./pages/settings/DomainsPage"));
const DeveloperPage = lazy(() => import("./pages/settings/DeveloperPage"));
const BillingPage = lazy(() => import("./pages/settings/BillingPage"));
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
const DocsIndexPage = lazy(() => import("./pages/DocsIndexPage"));
const DocsGettingStartedPage = lazy(() => import("./pages/DocsGettingStartedPage"));
const DocsConceptsPage = lazy(() => import("./pages/DocsConceptsPage"));
const DocsWebhooksPage = lazy(() => import("./pages/DocsWebhooksPage"));
const GuidesIndexPage = lazy(() => import("./pages/GuidesIndexPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const HubIndexPage = lazy(() => import("./pages/HubIndexPage"));
const HubPage = lazy(() => import("./pages/HubPage"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const ResearchPage = lazy(() => import("./pages/ResearchPage"));
const GetStartedAppPage = lazy(() => import("./pages/GetStartedAppPage"));
const CalendarAppPage = lazy(() => import("./pages/CalendarAppPage"));
const AiAssistantPage = lazy(() => import("./pages/AiAssistantPage"));
const NewslettersAppPage = lazy(() => import("./pages/NewslettersAppPage"));
const NewsletterPublicPage = lazy(() => import("./pages/NewsletterPublicPage"));
const BookingsAppPage = lazy(() => import("./pages/BookingsAppPage"));
const MailboxesAppPage = lazy(() => import("./pages/MailboxesAppPage"));
const AnalyticsAppPage = lazy(() => import("./pages/AnalyticsAppPage"));
const ContactsAppPage = lazy(() => import("./pages/ContactsAppPage"));
const PrimitivesGalleryPage = lazy(() => import("./pages/PrimitivesGalleryPage"));

function Screen({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className={tw.authShell}><p className={tw.muted}>Loading Flap…</p></div>}>{children}</Suspense>;
}

const SEO_PATH_SET = new Set<string>(SEO_PATHS);
const DNS_TOOL_PATHS = new Set<string>(DNS_TOOL_PATH_LIST);
const GUIDE_PATHS = new Set<string>(GUIDE_PATH_LIST);
const BLOG_PATH_SET = new Set<string>(BLOG_PATHS);
const FOR_PATH_SET = new Set<string>(FOR_PATHS);
const VS_PATH_SET = new Set<string>(VS_PATHS);

export default function App() {
  const [path, setPath] = useState(() => normalizePathname(window.location.pathname));
  useEffect(() => {
    const onPop = () => setPath(normalizePathname(window.location.pathname));
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
  if (path === "/sso-callback") return <Screen><SsoCallback /></Screen>;
  if (path === "/auth/verify") return <Screen><AuthVerify /></Screen>;
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
  if (path === "/app/domains") {
    return (
      <Screen>
        <RequireVerified>
          <DomainsPage />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app/billing") {
    return (
      <Screen>
        <RequireVerified>
          <BillingPage />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app/developer") {
    return (
      <Screen>
        <RequireVerified>
          <DeveloperPage />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app/dev/primitives") {
    return (
      <Screen>
        <RequireVerified>
          <PrimitivesGalleryPage />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app/get-started") {
    return (
      <Screen>
        <RequireVerified>
          <GetStartedAppPage />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app/calendar") {
    return (
      <Screen>
        <RequireVerified>
          <CalendarAppPage />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app/ai" || path === "/app/assistant") {
    return (
      <Screen>
        <RequireVerified>
          <AiAssistantPage />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app/newsletters") {
    return (
      <Screen>
        <RequireVerified>
          <NewslettersAppPage />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app/bookings") {
    return (
      <Screen>
        <RequireVerified>
          <BookingsAppPage />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app/mailboxes") {
    return (
      <Screen>
        <RequireVerified>
          <MailboxesAppPage />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app/analytics") {
    return (
      <Screen>
        <RequireVerified>
          <AnalyticsAppPage />
        </RequireVerified>
      </Screen>
    );
  }
  if (path === "/app/contacts") {
    return (
      <Screen>
        <RequireVerified>
          <ContactsAppPage />
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


  if (path === "/security") return <Screen><SecurityPage /></Screen>;
  if (path === "/for") return <Screen><HubIndexPage kind="for" /></Screen>;
  if (path === "/vs") return <Screen><HubIndexPage kind="vs" /></Screen>;
  if (FOR_PATH_SET.has(path) || VS_PATH_SET.has(path)) {
    return <Screen><HubPage path={path} /></Screen>;
  }
  if (path === "/research" || path.startsWith("/research/")) {
    return <Screen><ResearchPage path={path} /></Screen>;
  }
  if (path.startsWith("/n/")) {
    return <Screen><NewsletterPublicPage path={path} /></Screen>;
  }
  if (path.startsWith("/book/") || path === "/book") {
    return <Screen><BookingPage path={path} /></Screen>;
  }
  if (path === "/pricing") return <Screen><PricingPage /></Screen>;
  if (path === "/docs") return <Screen><DocsIndexPage /></Screen>;
  if (path === "/docs/getting-started") return <Screen><DocsGettingStartedPage /></Screen>;
  if (path === "/docs/concepts") return <Screen><DocsConceptsPage /></Screen>;
  if (path === "/docs/webhooks") return <Screen><DocsWebhooksPage /></Screen>;
  if (path === "/docs/api") return <Screen><DocsApiPage /></Screen>;
  if (path === "/guides") return <Screen><GuidesIndexPage /></Screen>;
  if (path === "/support") return <Screen><SupportPage /></Screen>;
  if (path === "/status") return <Screen><StatusPage /></Screen>;
  if (path === "/about") return <Screen><AboutPage /></Screen>;
  if (path === "/tools") return <Screen><ToolsIndex /></Screen>;
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
  if (BLOG_PATH_SET.has(path)) {
    return <Screen><BlogPost path={path} /></Screen>;
  }
  if (SEO_PATH_SET.has(path)) {
    return <Screen><SeoLanding path={path} /></Screen>;
  }
  if (path === "/") {
    return <Screen><Landing /></Screen>;
  }

  return <Screen><NotFoundPage /></Screen>;
}
