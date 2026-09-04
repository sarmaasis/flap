/**
 * @deprecated Custom OAuth handlers were replaced by Better Auth social providers
 * (`worker/lib/better-auth.ts` → `/api/auth/callback/{google|github}`).
 * This module remains only so older imports resolve during the cutover.
 */
export { googleConfigured, githubConfigured } from "./better-auth";
