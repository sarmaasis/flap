import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import Landing from "./pages/Landing";

const Login = lazy(() => import("./pages/Login"));
const Setup = lazy(() => import("./pages/Setup"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Settings = lazy(() => import("./pages/Settings"));

function Screen({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="auth-shell"><p className="muted">Loading Inlet…</p></div>}>{children}</Suspense>;
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  if (path === "/setup") return <Screen><Setup /></Screen>;
  if (path === "/login") return <Screen><Login /></Screen>;
  if (path === "/app/settings") return <Screen><Settings /></Screen>;
  if (path === "/app/compose") return <Screen><Inbox composeOpen /></Screen>;
  if (path === "/app" || path.startsWith("/app/")) return <Screen><Inbox /></Screen>;
  return <Landing />;
}
