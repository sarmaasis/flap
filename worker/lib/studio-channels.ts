/**
 * Newsletter, MCP/API v2, webhook hosts, quarantine, tracking, calendar, trust copy.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan, recordOutboundSend, assertSendRoom } from "./billing";
import {
  buildInviteIcs,
  bumpCalendarSync,
  eventToIcsPayload,
  hashCalendarToken,
  listAttendees,
  newCalendarTokenSecret,
  replaceAttendees,
  resolveOrganizerMailbox,
  sendCalendarMail,
} from "./calendar-invite";
import { nowMs, randomId } from "./ids";
import { buildIcs, parseIcs, type IcsAttendee } from "../../shared/ics";
import { resolveWorkspace } from "./team";
import { planAtLeast, type AppEnv } from "./plan-guard";
import { canSendMail, sendRawEmail } from "./mail-provider";
import { buildRawMime } from "./mime";
import { EMAIL_RE, extractEmail } from "./mailutil";

const NEWSLETTER_BLAST_HARD_CAP = 500;

/** Process queued newsletter_blasts (called from cron). Simple loop; not a full ESP. */
export async function processQueuedNewsletterBlasts(env: Env): Promise<void> {
  const queued = await env.DB.prepare(
    `SELECT id, user_id, domain_id, subject, html_body, capped_count
     FROM newsletter_blasts
     WHERE status = 'queued'
     ORDER BY created_at ASC
     LIMIT 5`,
  )
    .all<{
      id: string;
      user_id: string;
      domain_id: string;
      subject: string;
      html_body: string;
      capped_count: number;
    }>()
    .catch(() => ({ results: [] as Array<{
      id: string;
      user_id: string;
      domain_id: string;
      subject: string;
      html_body: string;
      capped_count: number;
    }> }));

  for (const blast of queued.results ?? []) {
    await env.DB.prepare("UPDATE newsletter_blasts SET status = 'sending' WHERE id = ? AND status = 'queued'")
      .bind(blast.id)
      .run()
      .catch(() => undefined);

    const plan = await getEffectivePlan(env.DB, blast.user_id);
    const cap = Math.min(
      NEWSLETTER_BLAST_HARD_CAP,
      plan.limits.newsletter_sends_per_month || NEWSLETTER_BLAST_HARD_CAP,
    );

    const subs = await env.DB.prepare(
      `SELECT email, name FROM newsletter_subscribers
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at ASC
       LIMIT ?`,
    )
      .bind(blast.user_id, cap)
      .all<{ email: string; name: string }>()
      .catch(() => ({ results: [] as Array<{ email: string; name: string }> }));

    const recipients = subs.results ?? [];
    if (!recipients.length) {
      await env.DB.prepare(
        "UPDATE newsletter_blasts SET status = 'sent', capped_count = 0 WHERE id = ?",
      )
        .bind(blast.id)
        .run()
        .catch(() => undefined);
      continue;
    }

    const mailbox = await env.DB.prepare(
      "SELECT id, address FROM mailboxes WHERE user_id = ? ORDER BY created_at ASC LIMIT 1",
    )
      .bind(blast.user_id)
      .first<{ id: string; address: string }>();

    if (!mailbox || !canSendMail(env)) {
      await env.DB.prepare(
        "UPDATE newsletter_blasts SET status = 'failed', capped_count = 0 WHERE id = ?",
      )
        .bind(blast.id)
        .run()
        .catch(() => undefined);
      console.warn("Newsletter blast skipped — no mailbox or mail provider", blast.id);
      continue;
    }

    let sent = 0;
    for (const sub of recipients) {
      const sendLimit = await assertSendRoom(env.DB, blast.user_id);
      if (!sendLimit.ok) break;
      const to = extractEmail(sub.email);
      if (!EMAIL_RE.test(to)) continue;
      try {
        const raw = buildRawMime({
          from: mailbox.address,
          to,
          subject: blast.subject || "(no subject)",
          text: "",
          html: blast.html_body || "<p></p>",
        });
        await sendRawEmail(env, {
          envelopeFrom: mailbox.address,
          recipients: [to],
          rawMime: raw,
        });
        await recordOutboundSend(env.DB, blast.user_id);
        sent += 1;
      } catch (err) {
        console.warn("Newsletter recipient failed", blast.id, to, err);
      }
    }

    await env.DB.prepare(
      "UPDATE newsletter_blasts SET status = 'sent', capped_count = ? WHERE id = ?",
    )
      .bind(sent, blast.id)
      .run()
      .catch(() => undefined);
  }
}

type EventCore = {
  id: string;
  mailbox_id: string;
  uid: string;
  title: string;
  description: string;
  location: string;
  starts_at: number;
  ends_at: number;
  all_day: number;
  status: string;
  organizer_email: string;
  sequence: number;
  etag: string;
  created_at: number;
  updated_at: number;
};

const EVENT_COLS = `id, mailbox_id, uid, title, description, location, starts_at, ends_at, all_day, status,
  organizer_email, sequence, etag, created_at, updated_at`;

async function serializeEvent(db: D1Database, event: EventCore) {
  const attendees = await listAttendees(db, event.id);
  return { ...event, attendees };
}

function parseAttendeeInput(raw: unknown): IcsAttendee[] {
  if (!Array.isArray(raw)) return [];
  const out: IcsAttendee[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const email = item.trim().toLowerCase();
      if (email.includes("@")) out.push({ email, partstat: "NEEDS-ACTION" });
      continue;
    }
    if (item && typeof item === "object" && "email" in item) {
      const email = String((item as { email?: string }).email || "")
        .trim()
        .toLowerCase();
      if (!email.includes("@")) continue;
      out.push({
        email,
        displayName: String((item as { displayName?: string; display_name?: string }).displayName || (item as { display_name?: string }).display_name || "").slice(0, 120) || undefined,
        partstat: "NEEDS-ACTION",
      });
    }
  }
  return out;
}

export function registerStudioChannelRoutes(app: Hono<AppEnv>) {
  // --- Newsletter one-shot (P2#2) ---
  app.post("/api/newsletter/one-shot", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "team")) return c.json({ error: "One-shot newsletter requires Team." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as {
      domain_id?: string;
      subject?: string;
      html_body?: string;
      recipient_tag?: string;
      confirm_double_opt_in?: boolean;
    };
    if (!body.confirm_double_opt_in) {
      return c.json({ error: "Double opt-in confirmation required. This is not a full ESP." }, 400);
    }
    const id = randomId("blast");
    await c.env.DB.prepare(
      `INSERT INTO newsletter_blasts (id, user_id, domain_id, subject, html_body, recipient_tag, status, capped_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?)`,
    )
      .bind(
        id,
        ctx.workspaceId,
        body.domain_id || "",
        (body.subject || "").slice(0, 200),
        (body.html_body || "").slice(0, 100_000),
        (body.recipient_tag || "launch").slice(0, 64),
        nowMs(),
      )
      .run();
    return c.json({
      blast: { id, status: "queued" },
      hard_cap: 500,
      note: "One-shot only. Hard cap 500 recipients per blast. Not a Mailchimp replacement.",
    }, 201);
  });

  // --- MCP light (P2#1) read-only ---
  app.post("/api/mcp", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "pro")) return c.json({ error: "MCP light requires Pro or Team." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { method?: string; params?: Record<string, unknown> };
    const method = body.method || "list_domains";
    if (method === "list_domains") {
      const rows = await c.env.DB.prepare("SELECT id, name, color FROM domains WHERE user_id = ?")
        .bind(ctx.workspaceId)
        .all();
      return c.json({ result: rows.results ?? [] });
    }
    if (method === "unread_counts") {
      const rows = await c.env.DB.prepare(
        `SELECT d.name, COUNT(*) AS unread FROM messages m
         JOIN mailboxes mb ON mb.id = m.mailbox_id
         JOIN domains d ON d.id = mb.domain_id
         WHERE m.user_id = ? AND m.folder = 'inbox' AND m.unread = 1
         GROUP BY d.id`,
      )
        .bind(ctx.workspaceId)
        .all();
      return c.json({ result: rows.results ?? [] });
    }
    if (method === "thread_summary") {
      return c.json({
        result: { note: "Use /api/ai/summarize with confirm. MCP never auto-sends." },
        auto_send: false,
      });
    }
    if (method === "draft_with_confirm") {
      return c.json({
        result: { draft: body.params?.text || "", confirm_required: true, auto_send: false },
      });
    }
    return c.json({ error: `Unknown method ${method}. Allowed: list_domains, unread_counts, thread_summary, draft_with_confirm.` }, 400);
  });

  // --- API v2 stub + labels (P1#16, P2#7) ---
  app.get("/api/v2/labels", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "pro")) return c.json({ error: "API v2 requires Pro or Team." }, 402);
    const rows = await c.env.DB.prepare("SELECT id, name, color FROM labels WHERE user_id = ?")
      .bind(ctx.workspaceId)
      .all();
    return c.json({ data: rows.results ?? [], api_version: "2" });
  });

  app.get("/api/v2/openapi.json", (c) =>
    c.json({
      openapi: "3.0.0",
      info: { title: "Flap API v2", version: "2.0.0" },
      paths: {
        "/api/v2/labels": { get: { summary: "List labels" } },
        "/api/mcp": { post: { summary: "MCP light (read-only + draft confirm)" } },
      },
    }),
  );

  // --- Custom webhook host (P1#19) ---
  app.post("/api/webhook-hosts", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "team")) return c.json({ error: "Custom webhook hosts require Team." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { hostname?: string };
    const hostname = (body.hostname || "").toLowerCase().trim();
    if (!hostname) return c.json({ error: "hostname required." }, 400);
    const id = randomId("hookhost");
    await c.env.DB.prepare(
      "INSERT INTO webhook_custom_hosts (id, user_id, hostname, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind(id, ctx.workspaceId, hostname, nowMs())
      .run()
      .catch(() => undefined);
    return c.json({
      host: { id, hostname, verified: false },
      dns: { type: "CNAME", name: hostname, value: "hooks.useflap.online" },
    }, 201);
  });

  // --- SSO stub (P2#3) ---
  app.get("/api/sso/status", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const plan = await getEffectivePlan(c.env.DB, user.id);
    return c.json({
      available: planAtLeast(plan.plan_id, "team"),
      providers: ["google_workspace_oidc", "okta_saml"],
      status: "configure_in_dashboard",
      note: "SSO wiring for Team orgs. Contact support to enable IdP metadata.",
    });
  });

  // --- Open tracking default off (P1#17) ---
  app.post("/api/mail/:id/open-track", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Open tracking opt-in requires Solo+." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
    await c.env.DB.prepare("UPDATE messages SET open_track = ? WHERE id = ? AND user_id = ?")
      .bind(body.enabled ? 1 : 0, c.req.param("id"), ctx.workspaceId)
      .run();
    return c.json({ ok: true, open_track: Boolean(body.enabled), default: false });
  });

  // --- Virus quarantine list (P1#18) ---
  app.get("/api/quarantine", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "pro")) return c.json({ error: "Quarantine requires Pro+.", items: [] }, 402);
    const rows = await c.env.DB.prepare(
      "SELECT id, subject, from_addr, virus_status, created_at FROM messages WHERE user_id = ? AND virus_status = 'quarantine' ORDER BY created_at DESC LIMIT 50",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({
      items: rows.results ?? [],
      note: "Attachments are scanned when a scanner is configured. Quarantined items stay undownloadable until released.",
    });
  });

  // --- Calendar events (native Flap calendar) ---
  app.get("/api/calendar/events", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const fromRaw = Number(c.req.query("from") || 0);
    const toRaw = Number(c.req.query("to") || 0);
    const from = Number.isFinite(fromRaw) && fromRaw > 0 ? fromRaw : nowMs() - 7 * 86400000;
    const to = Number.isFinite(toRaw) && toRaw > 0 ? toRaw : nowMs() + 40 * 86400000;
    const rows = await c.env.DB.prepare(
      `SELECT ${EVENT_COLS}
       FROM calendar_events
       WHERE user_id = ? AND starts_at < ? AND ends_at > ?
       ORDER BY starts_at ASC
       LIMIT 500`,
    )
      .bind(ctx.workspaceId, to, from)
      .all<EventCore>();
    const events = [];
    for (const row of rows.results || []) {
      events.push(await serializeEvent(c.env.DB, row));
    }
    return c.json({ events });
  });

  app.post("/api/calendar/events", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
      location?: string;
      starts_at?: number;
      ends_at?: number;
      all_day?: boolean;
      mailbox_id?: string;
      attendees?: unknown;
      send_invites?: boolean;
    };
    const title = (body.title || "").trim().slice(0, 200);
    const startsAt = Number(body.starts_at);
    const endsAt = Number(body.ends_at);
    if (!title) return c.json({ error: "Title is required." }, 400);
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
      return c.json({ error: "Valid start and end times are required." }, 400);
    }
    const attendees = parseAttendeeInput(body.attendees);
    const sendInvites = Boolean(body.send_invites && attendees.length);
    if (sendInvites) {
      const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
      if (!planAtLeast(plan.plan_id, "solo")) {
        return c.json({ error: "Sending calendar invitations requires Solo or higher." }, 402);
      }
    }
    const mailbox = await resolveOrganizerMailbox(c.env.DB, ctx.workspaceId, body.mailbox_id);
    const id = randomId("cevt");
    const uid = `${id}@flap`;
    const now = nowMs();
    const etag = `"${now}"`;
    const organizerEmail = mailbox?.address || "";
    await c.env.DB.prepare(
      `INSERT INTO calendar_events
        (id, user_id, mailbox_id, uid, title, description, location, starts_at, ends_at, all_day, status,
         organizer_email, sequence, etag, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, 0, ?, ?, ?)`,
    )
      .bind(
        id,
        ctx.workspaceId,
        mailbox?.id || (body.mailbox_id || "").slice(0, 64),
        uid,
        title,
        (body.description || "").slice(0, 4000),
        (body.location || "").slice(0, 400),
        startsAt,
        endsAt,
        body.all_day ? 1 : 0,
        organizerEmail,
        etag,
        now,
        now,
      )
      .run();
    if (attendees.length) await replaceAttendees(c.env.DB, id, attendees);

    let invite_sent = 0;
    let invite_error: string | undefined;
    if (sendInvites && mailbox) {
      const ics = buildInviteIcs(
        eventToIcsPayload(
          {
            uid,
            title,
            description: body.description || "",
            location: body.location || "",
            starts_at: startsAt,
            ends_at: endsAt,
            all_day: body.all_day ? 1 : 0,
            sequence: 0,
            organizer_email: organizerEmail,
            status: "confirmed",
          },
          attendees,
          mailbox.display_name || undefined,
        ),
        "REQUEST",
      );
      const when = new Date(startsAt).toLocaleString();
      const sent = await sendCalendarMail(c.env, {
        workspaceId: ctx.workspaceId,
        mailbox,
        to: attendees.map((a) => a.email),
        subject: `Invitation: ${title}`,
        text: [
          `${mailbox.display_name || mailbox.address} invited you to “${title}”.`,
          `When: ${when}`,
          body.location ? `Where: ${body.location}` : "",
          body.description || "",
          "",
          "Open the attached .ics to respond in your calendar app, or reply with Accept / Decline.",
        ]
          .filter(Boolean)
          .join("\n"),
        ics,
        filename: "invite.ics",
        contentType: "text/calendar; charset=utf-8; method=REQUEST",
      });
      if (sent.ok) invite_sent = attendees.length;
      else invite_error = sent.error;
    }

    await bumpCalendarSync(c.env.DB, ctx.workspaceId);
    const event = await c.env.DB.prepare(`SELECT ${EVENT_COLS} FROM calendar_events WHERE id = ? AND user_id = ?`)
      .bind(id, ctx.workspaceId)
      .first<EventCore>();
    return c.json(
      {
        event: event ? await serializeEvent(c.env.DB, event) : null,
        invite_sent,
        invite_error,
      },
      201,
    );
  });

  app.patch("/api/calendar/events/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare(
      `SELECT ${EVENT_COLS} FROM calendar_events WHERE id = ? AND user_id = ?`,
    )
      .bind(id, ctx.workspaceId)
      .first<EventCore>();
    if (!existing) return c.json({ error: "Event not found." }, 404);
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
      location?: string;
      starts_at?: number;
      ends_at?: number;
      all_day?: boolean;
      mailbox_id?: string;
      status?: string;
      attendees?: unknown;
      send_invites?: boolean;
    };
    const title = body.title !== undefined ? body.title.trim().slice(0, 200) : existing.title;
    const startsAt = body.starts_at !== undefined ? Number(body.starts_at) : existing.starts_at;
    const endsAt = body.ends_at !== undefined ? Number(body.ends_at) : existing.ends_at;
    if (!title) return c.json({ error: "Title is required." }, 400);
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
      return c.json({ error: "Valid start and end times are required." }, 400);
    }
    const attendees =
      body.attendees !== undefined ? parseAttendeeInput(body.attendees) : await listAttendees(c.env.DB, id);
    const sendInvites = Boolean(body.send_invites && attendees.length);
    if (sendInvites) {
      const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
      if (!planAtLeast(plan.plan_id, "solo")) {
        return c.json({ error: "Sending calendar invitations requires Solo or higher." }, 402);
      }
    }
    const mailbox = await resolveOrganizerMailbox(
      c.env.DB,
      ctx.workspaceId,
      body.mailbox_id !== undefined ? body.mailbox_id : existing.mailbox_id,
    );
    const now = nowMs();
    const sequence = (existing.sequence || 0) + (sendInvites || body.title !== undefined || body.starts_at !== undefined ? 1 : 0);
    const etag = `"${now}"`;
    await c.env.DB.prepare(
      `UPDATE calendar_events SET
         title = ?, description = ?, location = ?, starts_at = ?, ends_at = ?, all_day = ?,
         mailbox_id = ?, status = ?, organizer_email = ?, sequence = ?, etag = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
      .bind(
        title,
        body.description !== undefined ? body.description.slice(0, 4000) : existing.description,
        body.location !== undefined ? body.location.slice(0, 400) : existing.location,
        startsAt,
        endsAt,
        body.all_day !== undefined ? (body.all_day ? 1 : 0) : existing.all_day,
        mailbox?.id || (body.mailbox_id !== undefined ? body.mailbox_id.slice(0, 64) : existing.mailbox_id),
        (body.status || existing.status || "confirmed").slice(0, 32),
        mailbox?.address || existing.organizer_email,
        sequence,
        etag,
        now,
        id,
        ctx.workspaceId,
      )
      .run();
    if (body.attendees !== undefined) await replaceAttendees(c.env.DB, id, attendees);

    let invite_sent = 0;
    let invite_error: string | undefined;
    if (sendInvites && mailbox) {
      const ics = buildInviteIcs(
        eventToIcsPayload(
          {
            uid: existing.uid,
            title,
            description: body.description !== undefined ? body.description : existing.description,
            location: body.location !== undefined ? body.location : existing.location,
            starts_at: startsAt,
            ends_at: endsAt,
            all_day: body.all_day !== undefined ? (body.all_day ? 1 : 0) : existing.all_day,
            sequence,
            organizer_email: mailbox.address,
            status: body.status || existing.status,
          },
          attendees,
          mailbox.display_name || undefined,
        ),
        "REQUEST",
      );
      const sent = await sendCalendarMail(c.env, {
        workspaceId: ctx.workspaceId,
        mailbox,
        to: attendees.map((a) => a.email),
        subject: `Updated invitation: ${title}`,
        text: `“${title}” was updated. See the attached calendar invite.`,
        ics,
        filename: "invite.ics",
        contentType: "text/calendar; charset=utf-8; method=REQUEST",
      });
      if (sent.ok) invite_sent = attendees.length;
      else invite_error = sent.error;
    }

    await bumpCalendarSync(c.env.DB, ctx.workspaceId);
    const event = await c.env.DB.prepare(`SELECT ${EVENT_COLS} FROM calendar_events WHERE id = ? AND user_id = ?`)
      .bind(id, ctx.workspaceId)
      .first<EventCore>();
    return c.json({
      event: event ? await serializeEvent(c.env.DB, event) : null,
      invite_sent,
      invite_error,
    });
  });

  app.delete("/api/calendar/events/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare(
      `SELECT ${EVENT_COLS} FROM calendar_events WHERE id = ? AND user_id = ?`,
    )
      .bind(id, ctx.workspaceId)
      .first<EventCore>();
    if (!existing) return c.json({ error: "Event not found." }, 404);
    const notify = c.req.query("notify") === "1";
    if (notify) {
      const attendees = await listAttendees(c.env.DB, id);
      const mailbox = await resolveOrganizerMailbox(c.env.DB, ctx.workspaceId, existing.mailbox_id);
      if (attendees.length && mailbox) {
        const ics = buildInviteIcs(
          eventToIcsPayload(
            {
              uid: existing.uid,
              title: existing.title,
              description: existing.description,
              location: existing.location,
              starts_at: existing.starts_at,
              ends_at: existing.ends_at,
              all_day: existing.all_day,
              sequence: (existing.sequence || 0) + 1,
              organizer_email: existing.organizer_email || mailbox.address,
              status: "CANCELLED",
            },
            attendees.map((a) => ({ ...a, partstat: "DECLINED" })),
            mailbox.display_name || undefined,
          ),
          "CANCEL",
        );
        await sendCalendarMail(c.env, {
          workspaceId: ctx.workspaceId,
          mailbox,
          to: attendees.map((a) => a.email),
          subject: `Cancelled: ${existing.title}`,
          text: `“${existing.title}” has been cancelled.`,
          ics,
          filename: "cancel.ics",
          contentType: "text/calendar; charset=utf-8; method=CANCEL",
        });
      }
    }
    await c.env.DB.prepare("DELETE FROM calendar_attendees WHERE event_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM calendar_events WHERE id = ? AND user_id = ?")
      .bind(id, ctx.workspaceId)
      .run();
    await bumpCalendarSync(c.env.DB, ctx.workspaceId);
    return c.json({ ok: true });
  });

  // --- Calendar invitations RSVP ---
  app.post("/api/calendar/rsvp", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Calendar RSVP requires Solo or higher." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as {
      message_id?: string;
      response?: "accept" | "decline" | "maybe";
    };
    const response = body.response || "accept";
    const partstat =
      response === "decline" ? "DECLINED" : response === "maybe" ? "TENTATIVE" : "ACCEPTED";
    const messageId = (body.message_id || "").trim();
    if (!messageId) return c.json({ error: "message_id is required." }, 400);

    const message = await c.env.DB.prepare(
      `SELECT id, mailbox_id, from_addr, to_addr, subject, rfc_message_id
       FROM messages WHERE id = ? AND user_id = ?`,
    )
      .bind(messageId, ctx.workspaceId)
      .first<{
        id: string;
        mailbox_id: string;
        from_addr: string;
        to_addr: string;
        subject: string;
        rfc_message_id: string | null;
      }>();
    if (!message) return c.json({ error: "Message not found." }, 404);

    let icsText = "";
    if (c.env.ATTACHMENTS) {
      const atts = await c.env.DB.prepare(
        `SELECT id, r2_key, filename, content_type FROM attachments WHERE message_id = ?`,
      )
        .bind(messageId)
        .all<{ id: string; r2_key: string; filename: string; content_type: string }>();
      for (const att of atts.results || []) {
        const isCal =
          /calendar/i.test(att.content_type || "") || /\.ics$/i.test(att.filename || "");
        if (!isCal) continue;
        const obj = await c.env.ATTACHMENTS.get(att.r2_key);
        if (!obj) continue;
        icsText = await obj.text();
        if (icsText.includes("BEGIN:VEVENT")) break;
      }
    }
    if (!icsText) {
      return c.json(
        { error: "No calendar invite (.ics) found on this message. Download and open the attachment manually." },
        422,
      );
    }
    const parsed = parseIcs(icsText);
    if (!parsed) return c.json({ error: "Could not parse the calendar invite." }, 422);

    const mailbox = await resolveOrganizerMailbox(c.env.DB, ctx.workspaceId, message.mailbox_id);
    if (!mailbox) return c.json({ error: "Add a mailbox before RSVPing." }, 400);

    const now = nowMs();
    let event = await c.env.DB.prepare(
      `SELECT ${EVENT_COLS} FROM calendar_events WHERE user_id = ? AND uid = ?`,
    )
      .bind(ctx.workspaceId, parsed.uid)
      .first<EventCore>();

    if (partstat === "ACCEPTED" || partstat === "TENTATIVE") {
      if (event) {
        await c.env.DB.prepare(
          `UPDATE calendar_events SET title = ?, description = ?, location = ?, starts_at = ?, ends_at = ?,
             sequence = ?, etag = ?, updated_at = ?, organizer_email = ?, status = 'confirmed'
           WHERE id = ?`,
        )
          .bind(
            parsed.title.slice(0, 200),
            (parsed.description || "").slice(0, 4000),
            (parsed.location || "").slice(0, 400),
            parsed.startsAt,
            parsed.endsAt,
            Math.max(parsed.sequence, event.sequence || 0),
            `"${now}"`,
            now,
            parsed.organizerEmail || event.organizer_email,
            event.id,
          )
          .run();
      } else {
        const id = randomId("cevt");
        await c.env.DB.prepare(
          `INSERT INTO calendar_events
            (id, user_id, mailbox_id, uid, title, description, location, starts_at, ends_at, all_day, status,
             organizer_email, sequence, etag, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'confirmed', ?, ?, ?, ?, ?)`,
        )
          .bind(
            id,
            ctx.workspaceId,
            mailbox.id,
            parsed.uid,
            parsed.title.slice(0, 200),
            (parsed.description || "").slice(0, 4000),
            (parsed.location || "").slice(0, 400),
            parsed.startsAt,
            parsed.endsAt,
            parsed.organizerEmail || "",
            parsed.sequence || 0,
            `"${now}"`,
            now,
            now,
          )
          .run();
        event = await c.env.DB.prepare(`SELECT ${EVENT_COLS} FROM calendar_events WHERE id = ?`)
          .bind(id)
          .first<EventCore>();
      }
    }

    if (event) {
      await c.env.DB.prepare(
        `INSERT INTO calendar_attendees (id, event_id, email, display_name, role, partstat, created_at, updated_at)
         VALUES (?, ?, ?, '', 'REQ-PARTICIPANT', ?, ?, ?)
         ON CONFLICT(event_id, email) DO UPDATE SET partstat = excluded.partstat, updated_at = excluded.updated_at`,
      )
        .bind(randomId("catt"), event.id, mailbox.address.toLowerCase(), partstat, now, now)
        .run();
    }

    const replyAttendee: IcsAttendee = {
      email: mailbox.address,
      displayName: mailbox.display_name || undefined,
      partstat,
    };
    const replyIcs = buildInviteIcs(
      {
        uid: parsed.uid,
        title: parsed.title,
        description: parsed.description,
        location: parsed.location,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        sequence: parsed.sequence,
        organizerEmail: parsed.organizerEmail,
        attendees: [replyAttendee],
        status: partstat === "DECLINED" ? "CANCELLED" : "CONFIRMED",
      },
      "REPLY",
    );

    const organizerTo = parsed.organizerEmail || message.from_addr;
    const label = response === "accept" ? "Accepted" : response === "decline" ? "Declined" : "Tentative";
    const sent = await sendCalendarMail(c.env, {
      workspaceId: ctx.workspaceId,
      mailbox,
      to: [organizerTo],
      subject: `${label}: ${parsed.title}`,
      text: `${mailbox.address} ${label.toLowerCase()} the invitation “${parsed.title}”.`,
      ics: replyIcs,
      filename: "reply.ics",
      contentType: "text/calendar; charset=utf-8; method=REPLY",
      inReplyTo: message.rfc_message_id,
    });
    if (!sent.ok) {
      return c.json({ error: sent.error }, sent.status as 400 | 402 | 501 | 502);
    }

    await bumpCalendarSync(c.env.DB, ctx.workspaceId);
    return c.json({
      ok: true,
      response,
      partstat,
      event_id: event?.id || null,
      reply_message_id: sent.id,
    });
  });

  // --- CalDAV app passwords ---
  app.get("/api/calendar/tokens", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const rows = await c.env.DB.prepare(
      `SELECT id, label, token_prefix, created_at, last_used_at
       FROM calendar_app_tokens WHERE user_id = ? ORDER BY created_at DESC`,
    )
      .bind(ctx.workspaceId)
      .all();
    const origin = new URL(c.req.url).origin;
    return c.json({
      tokens: rows.results || [],
      caldav_url: `${origin}/dav/calendars/${encodeURIComponent(ctx.workspaceId)}/`,
      username_hint: "your mailbox email (or any username)",
      note: "Create an app password, then add this CalDAV URL in Apple Calendar, Thunderbird, or similar.",
    });
  });

  app.post("/api/calendar/tokens", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) {
      return c.json({ error: "CalDAV app passwords require Solo or higher." }, 402);
    }
    const body = (await c.req.json().catch(() => ({}))) as { label?: string };
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM calendar_app_tokens WHERE user_id = ?")
      .bind(ctx.workspaceId)
      .first<{ n: number }>();
    if (Number(count?.n || 0) >= 10) {
      return c.json({ error: "Limit of 10 calendar app passwords reached. Revoke one first." }, 400);
    }
    const token = newCalendarTokenSecret();
    const id = randomId("ctok");
    const now = nowMs();
    await c.env.DB.prepare(
      `INSERT INTO calendar_app_tokens (id, user_id, token_hash, label, token_prefix, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        ctx.workspaceId,
        await hashCalendarToken(token),
        (body.label || "CalDAV").trim().slice(0, 80) || "CalDAV",
        token.slice(0, 12),
        now,
      )
      .run();
    const origin = new URL(c.req.url).origin;
    return c.json(
      {
        token: {
          id,
          label: (body.label || "CalDAV").trim().slice(0, 80) || "CalDAV",
          token,
          token_prefix: token.slice(0, 12),
          created_at: now,
        },
        caldav_url: `${origin}/dav/calendars/${encodeURIComponent(ctx.workspaceId)}/`,
        note: "Copy the token now — it is shown only once.",
      },
      201,
    );
  });

  app.delete("/api/calendar/tokens/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const result = await c.env.DB.prepare("DELETE FROM calendar_app_tokens WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .run();
    if (!result.meta.changes) return c.json({ error: "Token not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/calendar/feed.ics", async (c) => {
    const token = (c.req.query("token") || "").trim();
    if (!token.startsWith("flapcal_")) return c.json({ error: "Valid calendar token required." }, 401);
    const hash = await hashCalendarToken(token);
    const row = await c.env.DB.prepare("SELECT id, user_id FROM calendar_app_tokens WHERE token_hash = ?")
      .bind(hash)
      .first<{ id: string; user_id: string }>();
    if (!row) return c.json({ error: "Invalid token." }, 401);
    await c.env.DB.prepare("UPDATE calendar_app_tokens SET last_used_at = ? WHERE id = ?")
      .bind(nowMs(), row.id)
      .run();
    const events = await c.env.DB.prepare(
      `SELECT ${EVENT_COLS} FROM calendar_events WHERE user_id = ? ORDER BY starts_at ASC LIMIT 2000`,
    )
      .bind(row.user_id)
      .all<EventCore>();
    const vevents: string[] = [];
    for (const ev of events.results || []) {
      const attendees = await listAttendees(c.env.DB, ev.id);
      const full = buildIcs(
        eventToIcsPayload(
          {
            uid: ev.uid,
            title: ev.title,
            description: ev.description,
            location: ev.location,
            starts_at: ev.starts_at,
            ends_at: ev.ends_at,
            all_day: ev.all_day,
            sequence: ev.sequence,
            organizer_email: ev.organizer_email,
            status: ev.status,
          },
          attendees,
        ),
        "PUBLISH",
      );
      const match = /BEGIN:VEVENT[\s\S]*?END:VEVENT/.exec(full);
      if (match) vevents.push(match[0]);
    }
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Flap//Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...vevents, "END:VCALENDAR", ""].join(
      "\r\n",
    );
    return new Response(body, {
      headers: { "content-type": "text/calendar; charset=utf-8" },
    });
  });

  // --- Referral after verify payload (P1#25) ---
  app.get("/api/referrals/after-verify", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const ref = await c.env.DB.prepare("SELECT referral_code FROM users WHERE id = ?")
      .bind(ctx.workspaceId)
      .first<{ referral_code: string | null }>();
    const code = ref?.referral_code || "";
    return c.json({
      title: "Invite a founder, both get +1 domain",
      share_url: code ? `https://useflap.online/signup?ref=${code}` : "https://useflap.online/signup",
      share_text: "I just verified a domain on Flap. One inbox for every startup domain.",
    });
  });

  // --- Export trust copy (P0#16) ---
  app.get("/api/trust/export-policy", (c) =>
    c.json({
      cancel_export_window_days: 30,
      formats: [".mbox", "JSON backup"],
      retention: "You can export anytime from Settings. After cancel, a 30-day export window remains for paid accounts.",
      ownership: "Your mail stays yours. Flap is not a hostage inbox.",
    }),
  );

  // --- SLA copy (P2#14) honest ---
  app.get("/api/support/sla", (c) =>
    c.json({
      team: {
        response_target: "1 business day",
        channel: "support@useflap.online",
        note: "Team priority support target. Not a contractual uptime SLA yet.",
      },
      others: { channel: "support@useflap.online", note: "Best-effort email support." },
    }),
  );

  // --- Booking pages (CalDAV Partial; public request stub) ---
  app.get("/api/booking/:slug", async (c) => {
    const slug = c.req.param("slug").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
    const row = await c.env.DB.prepare(
      "SELECT slug, title, mailbox_id FROM booking_pages WHERE slug = ? AND enabled = 1",
    )
      .bind(slug)
      .first<{ slug: string; title: string; mailbox_id: string }>()
      .catch(() => null);
    return c.json({
      slug,
      title: row?.title || `Book with ${slug}`,
      status: row ? "configured" : "demo",
      caldav: {
        status: "partial",
        note: "CalDAV/CardDAV sync is Partial. Public booking accepts requests via API; live free/busy ships with calendar protocol work.",
      },
    });
  });

  app.post("/api/booking/:slug", async (c) => {
    const slug = c.req.param("slug").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
    const body = (await c.req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      note?: string;
    };
    const email = (body.email || "").trim().toLowerCase();
    const name = (body.name || "").trim().slice(0, 120);
    if (!email || !email.includes("@")) return c.json({ error: "Valid email required." }, 400);
    const id = randomId("book");
    await c.env.DB.prepare(
      `INSERT INTO booking_requests (id, slug, name, email, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, slug, name, email, (body.note || "").slice(0, 2000), nowMs())
      .run()
      .catch(() => undefined);
    return c.json({
      ok: true,
      id,
      message: "Request received. The host will confirm by email when the mailbox is live.",
    }, 201);
  });

  app.post("/api/booking-pages", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Booking pages require Solo or higher." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as {
      slug?: string;
      title?: string;
      mailbox_id?: string;
    };
    const slug = (body.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
    if (!slug) return c.json({ error: "slug required." }, 400);
    const id = randomId("bpage");
    await c.env.DB.prepare(
      `INSERT INTO booking_pages (id, user_id, slug, title, mailbox_id, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    )
      .bind(id, ctx.workspaceId, slug, (body.title || slug).slice(0, 120), body.mailbox_id || "", nowMs())
      .run()
      .catch(() => undefined);
    return c.json({ page: { id, slug, url: `/book/${slug}` } }, 201);
  });

  // --- Newsletter list + editor stubs (hard caps; not cold ESP) ---
  app.get("/api/newsletters", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    const rows = await c.env.DB.prepare(
      "SELECT id, subject, status, capped_count, created_at FROM newsletter_blasts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    )
      .bind(ctx.workspaceId)
      .all()
      .catch(() => ({ results: [] }));
    const subCount = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE user_id = ? AND status = 'active'",
    )
      .bind(ctx.workspaceId)
      .first<{ n: number }>()
      .catch(() => ({ n: 0 }));
    return c.json({
      items: rows.results ?? [],
      caps: {
        sends_per_month: plan.limits.newsletter_sends_per_month ?? 0,
        subscribers: plan.limits.newsletter_subscribers ?? 0,
      },
      audience_count: Number(subCount?.n ?? 0),
      note: "Newsletters are hard-capped. Queued blasts send via cron. Not a cold-outbound ESP.",
    });
  });

  app.get("/api/newsletters/subscribers", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const rows = await c.env.DB.prepare(
      `SELECT id, email, name, status, created_at
       FROM newsletter_subscribers WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 200`,
    )
      .bind(ctx.workspaceId)
      .all()
      .catch(() => ({ results: [] }));
    return c.json({
      subscribers: rows.results ?? [],
      note: "MVP audience list. CSV import and double opt-in flows are partial.",
    });
  });

  app.post("/api/newsletters/subscribers", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) {
      return c.json({ error: "Newsletters require Solo or higher." }, 402);
    }
    const body = (await c.req.json().catch(() => ({}))) as { email?: string; name?: string };
    const email = extractEmail(body.email || "").toLowerCase();
    if (!EMAIL_RE.test(email)) return c.json({ error: "Valid email required." }, 400);
    const count = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE user_id = ? AND status = 'active'",
    )
      .bind(ctx.workspaceId)
      .first<{ n: number }>()
      .catch(() => ({ n: 0 }));
    const max = plan.limits.newsletter_subscribers ?? 0;
    if (max > 0 && Number(count?.n ?? 0) >= max) {
      return c.json({ error: `Subscriber cap reached (${max}).` }, 402);
    }
    const id = randomId("nsub");
    try {
      await c.env.DB.prepare(
        `INSERT INTO newsletter_subscribers (id, user_id, email, name, status, created_at)
         VALUES (?, ?, ?, ?, 'active', ?)`,
      )
        .bind(id, ctx.workspaceId, email, (body.name || "").trim().slice(0, 120), nowMs())
        .run();
    } catch {
      return c.json({ error: "That email is already on this audience." }, 409);
    }
    return c.json({ subscriber: { id, email, name: (body.name || "").trim(), status: "active" } }, 201);
  });

  app.delete("/api/newsletters/subscribers/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const res = await c.env.DB.prepare(
      "DELETE FROM newsletter_subscribers WHERE id = ? AND user_id = ?",
    )
      .bind(c.req.param("id"), ctx.workspaceId)
      .run()
      .catch(() => ({ meta: { changes: 0 } }));
    if (!res.meta.changes) return c.json({ error: "Subscriber not found." }, 404);
    return c.json({ ok: true });
  });

  app.post("/api/newsletters", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) {
      return c.json({ error: "Newsletters require Solo or higher." }, 402);
    }
    const body = (await c.req.json().catch(() => ({}))) as {
      subject?: string;
      html_body?: string;
      domain_id?: string;
      queue?: boolean;
    };
    const subject = (body.subject || "").trim().slice(0, 200);
    if (!subject) return c.json({ error: "subject required." }, 400);
    const id = randomId("nl");
    const status = body.queue ? "queued" : "draft";
    await c.env.DB.prepare(
      `INSERT INTO newsletter_blasts (id, user_id, domain_id, subject, html_body, recipient_tag, status, capped_count, created_at)
       VALUES (?, ?, ?, ?, ?, '', ?, 0, ?)`,
    )
      .bind(
        id,
        ctx.workspaceId,
        body.domain_id || "",
        subject,
        (body.html_body || "").slice(0, 200_000),
        status,
        nowMs(),
      )
      .run()
      .catch(() => undefined);
    return c.json({ item: { id, subject, status } }, 201);
  });

  app.post("/api/newsletters/:id/queue", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const res = await c.env.DB.prepare(
      `UPDATE newsletter_blasts SET status = 'queued'
       WHERE id = ? AND user_id = ? AND status IN ('draft', 'failed')`,
    )
      .bind(c.req.param("id"), ctx.workspaceId)
      .run()
      .catch(() => ({ meta: { changes: 0 } }));
    if (!res.meta.changes) return c.json({ error: "Draft not found or already queued." }, 404);
    return c.json({ ok: true, status: "queued", note: "Cron will process this blast shortly." });
  });

  // --- IMAP/SMTP credential stubs (honest Partial) ---
  app.get("/api/mailboxes/:id/client-credentials", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "pro")) {
      return c.json({
        status: "scheduled",
        available: false,
        target_date: "2026-10-15",
        note: "IMAP/SMTP app passwords target Pro+. Until then use webmail and PWA.",
      });
    }
    return c.json({
      status: "scheduled",
      available: false,
      target_date: "2026-10-15",
      imap: { host: "imap.useflap.online", port: 993, tls: true },
      smtp: { host: "smtp.useflap.online", port: 587, starttls: true },
      jmap: { status: "deferred", note: "Evaluate after IMAP MVP." },
      caldav: { status: "available", path: "/dav/calendars/", note: "Create a calendar app password on /app/calendar." },
      carddav: { status: "partial", path: "/dav/contacts/" },
      note: "Connection settings are shown for planning. Credentials are not issued until the protocol path ships. Nothing here means Connected.",
    });
  });
}
