/**
 * Native AWS SNS HTTPS signature verification (WebCrypto, no extra npm deps).
 * Used by /api/inbound/ses/events when the body is an SNS envelope.
 */
import {
  isAllowedSnsSigningCertUrl,
  isSnsEnvelope,
  verifySnsSignatureWithPem,
} from "../../shared/security-guards";

const certCache = new Map<string, { pem: string; expiresAt: number }>();
const CERT_TTL_MS = 60 * 60 * 1000;
const CERT_CACHE_MAX = 32;

async function fetchSigningCertPem(url: string): Promise<string | null> {
  const cached = certCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.pem;

  const res = await fetch(url, {
    method: "GET",
    redirect: "error",
    headers: { accept: "application/x-pem-file,application/x-x509-ca-cert,text/plain,*/*" },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const pem = await res.text();
  if (!/-----BEGIN CERTIFICATE-----/.test(pem)) return null;

  if (certCache.size >= CERT_CACHE_MAX) {
    const oldest = certCache.keys().next().value;
    if (oldest) certCache.delete(oldest);
  }
  certCache.set(url, { pem, expiresAt: Date.now() + CERT_TTL_MS });
  return pem;
}

/**
 * Verify SNS SigningCertURL + Signature when payload is an SNS envelope.
 * Returns true when not an SNS envelope (caller still enforces Flap HMAC).
 * Returns false when envelope present but signature/cert invalid.
 */
export async function verifySnsEnvelopeIfPresent(
  payload: Record<string, unknown>,
): Promise<{ required: boolean; ok: boolean }> {
  if (!isSnsEnvelope(payload)) {
    return { required: false, ok: true };
  }

  const certUrl = String(payload.SigningCertURL ?? payload.SigningCertUrl ?? "");
  if (!isAllowedSnsSigningCertUrl(certUrl)) {
    console.warn("Rejected SNS SigningCertURL (host/protocol not allowed)");
    return { required: true, ok: false };
  }

  const pem = await fetchSigningCertPem(certUrl);
  if (!pem) {
    console.warn("SNS SigningCertURL fetch failed");
    return { required: true, ok: false };
  }

  const ok = await verifySnsSignatureWithPem(payload, pem);
  if (!ok) console.warn("SNS message signature verification failed");
  return { required: true, ok };
}
