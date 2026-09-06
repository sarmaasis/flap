/**
 * Re-export shared client-route helpers (Worker + App keep one source of truth).
 */
export {
  AUTH_SPA_PREFIXES as SPA_SHELL_PREFIXES,
  isKnownClientPath,
  isSpaShellPath,
  normalizePathname,
} from "../../shared/client-routes";
