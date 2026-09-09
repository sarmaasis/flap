/**
 * Native AWS SNS HTTPS signature verification (WebCrypto, no extra npm deps).
 * Used by /api/inbound/ses/events when the body is an SNS envelope.
 */
import {
  isAllowedSnsSubscribeUrl,
  isAllowedSnsSigningCertRedirectUrl,
  isAllowedSnsSigningCertUrl,
  isSnsEnvelope,
  verifySnsSignatureWithPem,
} from "../../shared/security-guards";

const certCache = new Map<string, { pem: string; expiresAt: number }>();
const CERT_TTL_MS = 60 * 60 * 1000;
const CERT_CACHE_MAX = 32;

async function fetchSigningCertPem(startUrl: string): Promise<string | null> {
  const cached = certCache.get(startUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.pem;

  let current = startUrl;
  for (let hop = 0; hop < 5; hop++) {
    const allowed =
      hop === 0 ? isAllowedSnsSigningCertUrl(current) : isAllowedSnsSigningCertRedirectUrl(current);
    if (!allowed) {
      console.warn("SNS cert URL host not allowed", { hop });
      return null;
    }

    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { accept: "application/x-pem-file,application/x-x509-ca-cert,text/plain,*/*" },
      });
    } catch (err) {
      console.warn("SNS SigningCertURL fetch threw", {
        hop,
        message: err instanceof Error ? err.message : "error",
      });
      return null;
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("Location");
      if (!loc) {
        console.warn("SNS SigningCertURL redirect without Location", { status: res.status, hop });
        return null;
      }
      try {
        current = new URL(loc, current).toString();
      } catch {
        console.warn("SNS SigningCertURL invalid redirect");
        return null;
      }
      continue;
    }

    if (!res.ok) {
      console.warn("SNS SigningCertURL HTTP error", { status: res.status, hop });
      return null;
    }
    const pem = await res.text();
    if (!/-----BEGIN CERTIFICATE-----/.test(pem)) {
      console.warn("SNS SigningCertURL body was not a PEM certificate");
      return null;
    }

    if (certCache.size >= CERT_CACHE_MAX) {
      const oldest = certCache.keys().next().value;
      if (oldest) certCache.delete(oldest);
    }
    certCache.set(startUrl, { pem, expiresAt: Date.now() + CERT_TTL_MS });
    return pem;
  }
  console.warn("SNS SigningCertURL too many redirects");
  return null;
}

/**
 * GET SubscribeURL to confirm the SNS HTTPS subscription.
 * Amazon often 302s this URL; `redirect: "error"` throws (logged as status 0).
 */
export async function confirmSnsSubscribeUrl(startUrl: string): Promise<boolean> {
  if (!isAllowedSnsSubscribeUrl(startUrl)) return false;
  let current = startUrl;
  for (let hop = 0; hop < 5; hop++) {
    if (!isAllowedSnsSubscribeUrl(current)) {
      console.warn("SNS SubscribeURL redirect host not allowed", { hop });
      return false;
    }
    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { accept: "text/xml,application/xml,text/plain,*/*" },
      });
    } catch (err) {
      console.warn("SNS SubscribeURL fetch threw", {
        hop,
        message: err instanceof Error ? err.message : "error",
      });
      return false;
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("Location");
      if (!loc) {
        console.warn("SNS SubscribeURL redirect without Location", { status: res.status, hop });
        return false;
      }
      try {
        current = new URL(loc, current).toString();
      } catch {
        console.warn("SNS SubscribeURL invalid redirect");
        return false;
      }
      continue;
    }
    if (!res.ok) {
      console.warn("SNS SubscribeURL HTTP error", { status: res.status, hop });
      return false;
    }
    return true;
  }
  console.warn("SNS SubscribeURL too many redirects");
  return false;
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
