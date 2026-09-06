import { normalizePathname } from "../content/public-routes";

export function go(path: string) {
  const hashIdx = path.indexOf("#");
  const rawNext = hashIdx >= 0 ? path.slice(0, hashIdx) : path;
  const hash = hashIdx >= 0 ? path.slice(hashIdx + 1) : "";
  const qIdx = rawNext.indexOf("?");
  const pathname = normalizePathname((qIdx >= 0 ? rawNext.slice(0, qIdx) : rawNext) || "/");
  const search = qIdx >= 0 ? rawNext.slice(qIdx) : "";
  const url = hash ? `${pathname}${search}#${hash}` : `${pathname}${search}`;
  window.history.pushState({}, "", url || "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
  if (hash) {
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    });
  }
}
