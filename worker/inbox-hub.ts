/**
 * Per-workspace Durable Object fan-out for inbox realtime (WebSocket hibernation).
 *
 * Uses `ctx.acceptWebSocket` so the DO can sleep while clients stay connected —
 * no GB-sec duration while idle (unlike the previous long-lived SSE design).
 */
import { DurableObject } from "cloudflare:workers";

export type InboxRealtimeEvent = {
  type: "mail.received" | "pong";
  at: number;
  message?: {
    id: string;
    from: string;
    to: string;
    subject: string;
    folder: string;
    label?: string;
  };
};

export class InboxHub extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/broadcast") {
      const event = (await request.json().catch(() => null)) as InboxRealtimeEvent | null;
      if (!event?.type) return new Response("bad event", { status: 400 });
      this.broadcast(event);
      return new Response("ok");
    }

    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      // Hibernation: do NOT call server.accept() alone — acceptWebSocket lets the DO sleep.
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ connectedAt: Date.now() });
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Optional client data-frame ping — wakes briefly, then DO may hibernate again.
    // Prefer this over DO setInterval keepalives (which prevent hibernation).
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    let isPing = text === "ping";
    if (!isPing) {
      try {
        const parsed = JSON.parse(text) as { type?: string };
        isPing = parsed.type === "ping";
      } catch {
        /* ignore */
      }
    }
    if (isPing) {
      try {
        ws.send(JSON.stringify({ type: "pong", at: Date.now() } satisfies InboxRealtimeEvent));
      } catch {
        /* closed */
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): Promise<void> {
    try {
      ws.close(code || 1000, reason || "ok");
    } catch {
      /* already closed / auto-replied */
    }
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try {
      ws.close(1011, "error");
    } catch {
      /* ignore */
    }
  }

  private broadcast(event: InboxRealtimeEvent): void {
    const payload = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        /* drop dead sockets; runtime cleans up */
      }
    }
  }
}

/** Notify connected inbox clients for this workspace (caller should waitUntil / not block ingest). */
export async function broadcastInboxEvent(
  env: Env,
  workspaceId: string,
  event: InboxRealtimeEvent,
): Promise<void> {
  const binding = env.INBOX_HUB;
  if (!binding) return;
  const id = binding.idFromName(workspaceId);
  const stub = binding.get(id);
  await stub.fetch("https://inbox-hub/broadcast", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
}
