/**
 * Known client routes for SPA shell vs soft-404 hygiene.
 * Keep in sync with App.tsx + wrangler run_worker_first SPA prefixes.
 */
export const SPA_SHELL_PREFIXES = [
  "/app",
  "/signup",
  "/login",
  "/setup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/invite",
  "/settings/referrals",
] as const;

export function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function isSpaShellPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return SPA_SHELL_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
