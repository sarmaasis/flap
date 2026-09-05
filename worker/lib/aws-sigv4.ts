/**
 * Minimal AWS Signature Version 4 for Workers (fetch-based SES / S3 APIs).
 * No AWS SDK dependency — keeps the Worker bundle small.
 */

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest);
}

async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function getSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode("AWS4" + secretKey).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export type AwsSignedRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string | Uint8Array;
};

export async function awsSignRequest(
  opts: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    service: string;
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string | Uint8Array;
  },
): Promise<AwsSignedRequest> {
  const url = new URL(opts.url);
  const method = opts.method.toUpperCase();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payload =
    typeof opts.body === "string"
      ? opts.body
      : opts.body
        ? opts.body
        : "";
  const payloadHash = await sha256Hex(
    typeof payload === "string"
      ? payload
      : payload instanceof Uint8Array
        ? payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength) as ArrayBuffer
        : new ArrayBuffer(0),
  );

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    ...(opts.headers || {}),
  };
  if (opts.body !== undefined && !headers["content-type"] && !headers["Content-Type"]) {
    headers["content-type"] = "application/x-www-form-urlencoded; charset=utf-8";
  }

  const signedHeaderKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[Object.keys(headers).find((h) => h.toLowerCase() === k)!].trim()}\n`).join("");
  const signedHeaders = signedHeaderKeys.join(";");

  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalRequest = [
    method,
    url.pathname || "/",
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${opts.region}/${opts.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");
  const signingKey = await getSigningKey(opts.secretAccessKey, dateStamp, opts.region, opts.service);
  const signature = toHex(await hmac(signingKey, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    method,
    url: opts.url,
    headers: { ...headers, Authorization: authorization },
    body: opts.body,
  };
}

export async function awsFetch(
  opts: Parameters<typeof awsSignRequest>[0],
): Promise<Response> {
  const signed = await awsSignRequest(opts);
  return fetch(signed.url, {
    method: signed.method,
    headers: signed.headers,
    body: signed.body === undefined ? undefined : (signed.body as BodyInit),
  });
}
