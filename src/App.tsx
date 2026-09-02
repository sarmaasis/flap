import { useEffect, useState } from "react";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Inbox from "./pages/Inbox";
import Settings from "./pages/Settings";

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  if (path === "/setup") return <Setup />;
  if (path === "/login") return <Login />;
  if (path === "/app/settings") return <Settings />;
  if (path === "/app/compose") return <Inbox composeOpen />;
  if (path === "/app" || path.startsWith("/app/")) return <Inbox />;
  return <Landing />;
}
