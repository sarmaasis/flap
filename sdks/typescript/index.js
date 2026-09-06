/** Thin Flap REST client (messages, domains, webhooks). */
export class Flap {
  constructor(apiKey, baseUrl = "https://useflap.online") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }
  async request(method, path, body) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }
  send(message) {
    return this.request("POST", "/api/v1/send", message);
  }
  domains() {
    return this.request("GET", "/api/domains");
  }
}
export default Flap;
