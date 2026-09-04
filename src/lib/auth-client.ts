import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { go } from "./nav";
import { storePendingVerifyEmail, verifyEmailPath } from "./verify-email";

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export function authErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

/** Better Auth `requireEmailVerification` rejects password sign-in with this. */
export function isEmailNotVerifiedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";
  const status = "status" in error ? Number((error as { status?: unknown }).status) : NaN;
  if (code === "EMAIL_NOT_VERIFIED" || code === "email_not_verified") return true;
  if (/email not verified/i.test(message)) return true;
  // Some client shapes only expose status + generic message.
  if (status === 403 && /verif/i.test(message)) return true;
  return false;
}

/** Redirect unverified password sign-in to the verify wall. */
export function handleUnverifiedSignIn(email: string, error: unknown): boolean {
  if (!isEmailNotVerifiedError(error)) return false;
  storePendingVerifyEmail(email);
  go(verifyEmailPath(email, "signin"));
  return true;
}
