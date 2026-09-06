/**
 * Per-workspace Durable Object fan-out for inbox realtime (SSE).
 * Clients subscribe; inbound mail broadcasts mail.received to open streams.
 */
export type InboxRealtimeEvent = {
  type: "mail.received" | "ping";
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

type Session = {
  id: string;
  writer: WritableStreamDefaultWriter<Uint8Array>;
};

const encoder = new TextEncoder();

export class InboxHub implements DurableObject {
  private sessions = new Map<string, Session>();

  // ctx reserved for future hibernation / alarm keepalive
  constructor(_ctx: DurableObjectState, _env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/broadcast") {
      const event = (await request.json().catch(() => null)) as InboxRealtimeEvent | null;
      if (!event?.type) return new Response("bad event", { status: 400 });
      await this.broadcast(event);
      return new Response("ok");
    }

    if (request.method === "GET" && (url.pathname === "/subscribe" || url.pathname === "/")) {
      return this.subscribe(request);
    }

    return new Response("not found", { status: 404 });
  }

  private subscribe(request: Request): Response {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const id = crypto.randomUUID();
    this.sessions.set(id, { id, writer });

    const send = async (chunk: string) => {
      try {
        await writer.write(encoder.encode(chunk));
      } catch {
        this.sessions.delete(id);
        try {
          await writer.close();
        } catch {
          /* already closed */
        }
      }
    };

    void send(`event: ping\ndata: ${JSON.stringify({ type: "ping", at: Date.now() })}\n\n`);

    const keepalive = setInterval(() => {
      void send(`: keepalive ${Date.now()}\n\n`);
    }, 25_000);

    const cleanup = () => {
      clearInterval(keepalive);
      this.sessions.delete(id);
      void writer.close().catch(() => undefined);
    };

    request.signal.addEventListener("abort", cleanup);

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  private async broadcast(event: InboxRealtimeEvent): Promise<void> {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    const dead: string[] = [];
    await Promise.all(
      [...this.sessions.values()].map(async (session) => {
        try {
          await session.writer.write(encoder.encode(payload));
        } catch {
          dead.push(session.id);
        }
      }),
    );
    for (const id of dead) {
      const session = this.sessions.get(id);
      this.sessions.delete(id);
      if (session) void session.writer.close().catch(() => undefined);
    }
  }
}

/** Notify connected inbox clients for this workspace (non-blocking caller should waitUntil). */
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
