const PENDING_KEY = "flap_pending_verify_email";

export function storePendingVerifyEmail(email: string) {
  const trimmed = email.trim().toLowerCase();
  if (trimmed) sessionStorage.setItem(PENDING_KEY, trimmed);
}

export function readPendingVerifyEmail(): string {
  return (sessionStorage.getItem(PENDING_KEY) || "").trim().toLowerCase();
}

export function verifyEmailPath(email: string, reason?: "signup" | "signin") {
  const params = new URLSearchParams();
  if (email.trim()) params.set("email", email.trim().toLowerCase());
  if (reason) params.set("reason", reason);
  const q = params.toString();
  return q ? `/verify-email?${q}` : "/verify-email";
}
