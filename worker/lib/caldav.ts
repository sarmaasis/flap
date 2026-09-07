/**
 * Thin CalDAV surface for Apple Calendar / Thunderbird / busycal-style clients.
 * Supports discovery, PROPFIND, GET, PUT, DELETE, and a basic calendar-query REPORT.
 */
import type { Context, Hono } from "hono";
import { buildIcs, parseIcs } from "../../shared/ics";
import {
  bumpCalendarSync,
  eventToIcsPayload,
  hashCalendarToken,
  listAttendees,
} from "./calendar-invite";
import { nowMs, randomId } from "./ids";
import type { AppEnv } from "./plan-guard";

type CalContext = Context<AppEnv>;

type CalUser = { userId: string; tokenId: string };

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function davResponse(xml: string, status = 207): Response {
  return new Response(xml, {
    status,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      DAV: "1, 3, calendar-access",
      Allow: "OPTIONS, GET, PUT, DELETE, PROPFIND, REPORT",
    },
  });
}

function unauthorized(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Flap CalDAV", charset="UTF-8"',
      DAV: "1, 3, calendar-access",
    },
  });
}

async function authenticateCalDav(c: { req: { header: (n: string) => string | undefined }; env: Env }): Promise<CalUser | null> {
  const auth = c.req.header("authorization") || "";
  let raw = "";
  if (auth.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = atob(auth.slice(6).trim());
      const colon = decoded.indexOf(":");
      raw = colon >= 0 ? decoded.slice(colon + 1) : decoded;
    } catch {
      return null;
    }
  } else if (auth.toLowerCase().startsWith("bearer ")) {
    raw = auth.slice(7).trim();
  }
  if (!raw.startsWith("flapcal_")) return null;
  const hash = await hashCalendarToken(raw);
  const row = await c.env.DB.prepare(
    "SELECT id, user_id FROM calendar_app_tokens WHERE token_hash = ?",
  )
    .bind(hash)
    .first<{ id: string; user_id: string }>();
  if (!row) return null;
  await c.env.DB.prepare("UPDATE calendar_app_tokens SET last_used_at = ? WHERE id = ?")
    .bind(nowMs(), row.id)
    .run();
  return { userId: row.user_id, tokenId: row.id };
}

async function syncMeta(db: D1Database, userId: string): Promise<{ sync_token: string; ctag: string }> {
  let row = await db
    .prepare("SELECT sync_token, ctag FROM calendar_sync WHERE user_id = ?")
    .bind(userId)
    .first<{ sync_token: string; ctag: string }>();
  if (!row) {
    await bumpCalendarSync(db, userId);
    row = await db
      .prepare("SELECT sync_token, ctag FROM calendar_sync WHERE user_id = ?")
      .bind(userId)
      .first<{ sync_token: string; ctag: string }>();
  }
  return row || { sync_token: "sync-0", ctag: "ctag-0" };
}

type EventRow = {
  id: string;
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
  updated_at: number;
};

async function listEvents(db: D1Database, userId: string): Promise<EventRow[]> {
  const rows = await db
    .prepare(
      `SELECT id, uid, title, description, location, starts_at, ends_at, all_day, status,
              organizer_email, sequence, etag, updated_at
       FROM calendar_events WHERE user_id = ? ORDER BY starts_at ASC LIMIT 2000`,
    )
    .bind(userId)
    .all<EventRow>();
  return rows.results || [];
}

async function eventIcs(db: D1Database, event: EventRow): Promise<string> {
  const attendees = await listAttendees(db, event.id);
  return buildIcs(
    eventToIcsPayload(
      {
        uid: event.uid,
        title: event.title,
        description: event.description,
        location: event.location,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        all_day: event.all_day,
        sequence: event.sequence,
        organizer_email: event.organizer_email,
        status: event.status,
      },
      attendees,
    ),
    "PUBLISH",
  );
}

function hrefFor(origin: string, userId: string, uid?: string): string {
  const base = `${origin}/dav/calendars/${encodeURIComponent(userId)}/`;
  return uid ? `${base}${encodeURIComponent(uid)}.ics` : base;
}

function propfindMultistatus(responses: string[]): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
${responses.join("\n")}
</d:multistatus>`;
}

function propOk(href: string, props: string): string {
  return `<d:response>
  <d:href>${xmlEscape(href)}</d:href>
  <d:propstat>
    <d:prop>
${props}
    </d:prop>
    <d:status>HTTP/1.1 200 OK</d:status>
  </d:propstat>
</d:response>`;
}

function withCalDavErrors(
  handler: (c: CalContext) => Promise<Response>,
): (c: CalContext) => Promise<Response> {
  return async (c) => {
    try {
      return await handler(c);
    } catch (err) {
      console.error("[caldav]", err);
      return new Response("CalDAV error", {
        status: 500,
        headers: { DAV: "1, 3, calendar-access" },
      });
    }
  };
}

export function registerCalDavRoutes(app: Hono<AppEnv>) {
  const paths = ["/dav", "/dav/", "/dav/*"];

  for (const path of paths) {
    app.on("OPTIONS", path, async () => {
      return new Response(null, {
        status: 204,
        headers: {
          DAV: "1, 3, calendar-access",
          Allow: "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, REPORT",
        },
      });
    });
  }

  app.on("PROPFIND", "/dav", withCalDavErrors(handlePropfind));
  app.on("PROPFIND", "/dav/", withCalDavErrors(handlePropfind));
  app.on("PROPFIND", "/dav/*", withCalDavErrors(handlePropfind));

  app.on("REPORT", "/dav/calendars/:userId", withCalDavErrors(handleReport));
  app.on("REPORT", "/dav/calendars/:userId/", withCalDavErrors(handleReport));
  app.on("REPORT", "/dav/calendars/:userId/*", withCalDavErrors(handleReport));

  app.get("/dav/calendars/:userId/:uid", withCalDavErrors(handleGet));
  app.put("/dav/calendars/:userId/:uid", withCalDavErrors(handlePut));
  app.delete("/dav/calendars/:userId/:uid", withCalDavErrors(handleDelete));

  // Friendly discovery landing (trailing slash is what many clients probe first)
  const discovery = (c: CalContext) =>
    c.json({
      status: "ok",
      caldav: "/dav/calendars/",
      note: "Use a CalDAV client with a Flap calendar app password (Settings → Calendar / Calendar page).",
    });
  app.get("/dav", discovery);
  app.get("/dav/", discovery);
  app.get("/dav/calendars", (c) => c.redirect("/dav/calendars/", 302));
  app.get("/dav/calendars/", async (c) => {
    const user = await authenticateCalDav(c);
    if (!user) return unauthorized();
    return c.redirect(`/dav/calendars/${encodeURIComponent(user.userId)}/`, 302);
  });
}

async function handlePropfind(c: CalContext): Promise<Response> {
  const user = await authenticateCalDav(c);
  if (!user) return unauthorized();
  const url = new URL(c.req.url);
  const origin = url.origin;
  const path = url.pathname.replace(/\/+$/, "") || "/dav";
  const depth = c.req.header("depth") || "0";
  const sync = await syncMeta(c.env.DB, user.userId);
  const calHref = hrefFor(origin, user.userId);

  if (path === "/dav" || path === "/dav/principals" || path.startsWith("/dav/principals/")) {
    const principal = `${origin}/dav/principals/${encodeURIComponent(user.userId)}/`;
    const responses = [
      propOk(path === "/dav" ? `${origin}/dav/` : principal, `
      <d:displayname>Flap</d:displayname>
      <d:resourcetype><d:collection/><d:principal/></d:resourcetype>
      <d:current-user-principal><d:href>${xmlEscape(principal)}</d:href></d:current-user-principal>
      <c:calendar-home-set><d:href>${xmlEscape(calHref)}</d:href></c:calendar-home-set>
      `),
    ];
    if (depth !== "0" && path === "/dav") {
      responses.push(
        propOk(principal, `
      <d:displayname>Flap user</d:displayname>
      <d:resourcetype><d:collection/><d:principal/></d:resourcetype>
      <c:calendar-home-set><d:href>${xmlEscape(calHref)}</d:href></c:calendar-home-set>
      `),
      );
    }
    return davResponse(propfindMultistatus(responses));
  }

  if (path === "/dav/calendars") {
    return davResponse(
      propfindMultistatus([
        propOk(`${origin}/dav/calendars/`, `
      <d:displayname>Calendars</d:displayname>
      <d:resourcetype><d:collection/></d:resourcetype>
      `),
        ...(depth !== "0"
          ? [
              propOk(calHref, `
      <d:displayname>Flap</d:displayname>
      <d:resourcetype><d:collection/><c:calendar/></d:resourcetype>
      <cs:getctag>${xmlEscape(sync.ctag)}</cs:getctag>
      <d:sync-token>${xmlEscape(sync.sync_token)}</d:sync-token>
      <c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>
      `),
            ]
          : []),
      ]),
    );
  }

  const calMatch = /^\/dav\/calendars\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (!calMatch || decodeURIComponent(calMatch[1]) !== user.userId) {
    return new Response("Not found", { status: 404 });
  }

  const rest = calMatch[2] || "";
  if (!rest) {
    const responses = [
      propOk(calHref, `
      <d:displayname>Flap</d:displayname>
      <d:resourcetype><d:collection/><c:calendar/></d:resourcetype>
      <cs:getctag>${xmlEscape(sync.ctag)}</cs:getctag>
      <d:sync-token>${xmlEscape(sync.sync_token)}</d:sync-token>
      <c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>
      <d:getcontenttype>text/calendar</d:getcontenttype>
      `),
    ];
    if (depth !== "0") {
      const events = await listEvents(c.env.DB, user.userId);
      for (const ev of events) {
        const href = hrefFor(origin, user.userId, ev.uid);
        const etag = ev.etag || `"${ev.updated_at}"`;
        responses.push(
          propOk(href, `
      <d:getetag>${xmlEscape(etag)}</d:getetag>
      <d:getcontenttype>text/calendar; charset=utf-8</d:getcontenttype>
      <d:resourcetype/>
      <c:calendar-data>${xmlEscape(await eventIcs(c.env.DB, ev))}</c:calendar-data>
      `),
        );
      }
    }
    return davResponse(propfindMultistatus(responses));
  }

  const uid = decodeURIComponent(rest.replace(/\.ics$/i, ""));
  const ev = await c.env.DB.prepare(
    `SELECT id, uid, title, description, location, starts_at, ends_at, all_day, status,
            organizer_email, sequence, etag, updated_at
     FROM calendar_events WHERE user_id = ? AND uid = ?`,
  )
    .bind(user.userId, uid)
    .first<EventRow>();
  if (!ev) return new Response("Not found", { status: 404 });
  const href = hrefFor(origin, user.userId, ev.uid);
  return davResponse(
    propfindMultistatus([
      propOk(href, `
      <d:getetag>${xmlEscape(ev.etag || `"${ev.updated_at}"`)}</d:getetag>
      <d:getcontenttype>text/calendar; charset=utf-8</d:getcontenttype>
      <c:calendar-data>${xmlEscape(await eventIcs(c.env.DB, ev))}</c:calendar-data>
      `),
    ]),
  );
}

async function handleReport(c: CalContext): Promise<Response> {
  const user = await authenticateCalDav(c);
  if (!user) return unauthorized();
  if (c.req.param("userId") !== user.userId) return new Response("Forbidden", { status: 403 });
  const origin = new URL(c.req.url).origin;
  const events = await listEvents(c.env.DB, user.userId);
  const responses: string[] = [];
  for (const ev of events) {
    const href = hrefFor(origin, user.userId, ev.uid);
    responses.push(
      propOk(href, `
      <d:getetag>${xmlEscape(ev.etag || `"${ev.updated_at}"`)}</d:getetag>
      <c:calendar-data>${xmlEscape(await eventIcs(c.env.DB, ev))}</c:calendar-data>
      `),
    );
  }
  return davResponse(propfindMultistatus(responses));
}

async function handleGet(c: CalContext): Promise<Response> {
  const user = await authenticateCalDav(c);
  if (!user) return unauthorized();
  if (c.req.param("userId") !== user.userId) return new Response("Forbidden", { status: 403 });
  const uid = decodeURIComponent((c.req.param("uid") || "").replace(/\.ics$/i, ""));
  const ev = await c.env.DB.prepare(
    `SELECT id, uid, title, description, location, starts_at, ends_at, all_day, status,
            organizer_email, sequence, etag, updated_at
     FROM calendar_events WHERE user_id = ? AND uid = ?`,
  )
    .bind(user.userId, uid)
    .first<EventRow>();
  if (!ev) return new Response("Not found", { status: 404 });
  const ics = await eventIcs(c.env.DB, ev);
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      etag: ev.etag || `"${ev.updated_at}"`,
      DAV: "1, 3, calendar-access",
    },
  });
}

async function handlePut(c: CalContext): Promise<Response> {
  const user = await authenticateCalDav(c);
  if (!user) return unauthorized();
  if (c.req.param("userId") !== user.userId) return new Response("Forbidden", { status: 403 });
  const body = await c.req.text();
  const parsed = parseIcs(body);
  if (!parsed) return new Response("Invalid iCalendar", { status: 400 });
  const pathUid = decodeURIComponent((c.req.param("uid") || "").replace(/\.ics$/i, ""));
  const uid = parsed.uid || pathUid;
  const now = nowMs();
  const etag = `"${now}"`;
  const existing = await c.env.DB.prepare("SELECT id, sequence FROM calendar_events WHERE user_id = ? AND uid = ?")
    .bind(user.userId, uid)
    .first<{ id: string; sequence: number }>();

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE calendar_events SET
         title = ?, description = ?, location = ?, starts_at = ?, ends_at = ?,
         sequence = ?, etag = ?, status = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
      .bind(
        parsed.title.slice(0, 200),
        (parsed.description || "").slice(0, 4000),
        (parsed.location || "").slice(0, 400),
        parsed.startsAt,
        parsed.endsAt,
        Math.max(parsed.sequence, (existing.sequence || 0) + 1),
        etag,
        "confirmed",
        now,
        existing.id,
        user.userId,
      )
      .run();
  } else {
    const id = randomId("cevt");
    await c.env.DB.prepare(
      `INSERT INTO calendar_events
        (id, user_id, mailbox_id, uid, title, description, location, starts_at, ends_at, all_day, status,
         organizer_email, sequence, etag, created_at, updated_at)
       VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, 0, 'confirmed', ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        user.userId,
        uid,
        parsed.title.slice(0, 200),
        (parsed.description || "").slice(0, 4000),
        (parsed.location || "").slice(0, 400),
        parsed.startsAt,
        parsed.endsAt,
        parsed.organizerEmail || "",
        parsed.sequence || 0,
        etag,
        now,
        now,
      )
      .run();
  }
  await bumpCalendarSync(c.env.DB, user.userId);
  return new Response(null, {
    status: existing ? 204 : 201,
    headers: { etag, DAV: "1, 3, calendar-access" },
  });
}

async function handleDelete(c: CalContext): Promise<Response> {
  const user = await authenticateCalDav(c);
  if (!user) return unauthorized();
  if (c.req.param("userId") !== user.userId) return new Response("Forbidden", { status: 403 });
  const uid = decodeURIComponent((c.req.param("uid") || "").replace(/\.ics$/i, ""));
  const result = await c.env.DB.prepare("DELETE FROM calendar_events WHERE user_id = ? AND uid = ?")
    .bind(user.userId, uid)
    .run();
  if (!result.meta.changes) return new Response("Not found", { status: 404 });
  await bumpCalendarSync(c.env.DB, user.userId);
  return new Response(null, { status: 204, headers: { DAV: "1, 3, calendar-access" } });
}
