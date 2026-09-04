export function go(path: string) {
  const hashIdx = path.indexOf("#");
  const next = hashIdx >= 0 ? path.slice(0, hashIdx) : path;
  const hash = hashIdx >= 0 ? path.slice(hashIdx + 1) : "";
  window.history.pushState({}, "", hash ? `${next || "/"}#${hash}` : next || "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
  if (hash) {
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    });
  }
}
