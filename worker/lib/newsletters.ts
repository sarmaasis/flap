/**
 * Newsletters: audience, drafts, scheduled/queued sends, double opt-in, unsubscribe.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan, recordOutboundSend, assertSendRoom } from "./billing";
import { nowMs, randomId } from "./ids";
import { resolveWorkspace } from "./team";
import { planAtLeast, type AppEnv } from "./plan-guard";
import { canSendMail, sendRawEmail } from "./mail-provider";
import { buildRawMime } from "./mime";
import { EMAIL_RE, extractEmail } from "./mailutil";
import { appOrigin } from "./system-email";
import { isAddressSuppressed } from "./inbound-webhook";
import { evaluateOutboundDomainPolicy } from "../../shared/outbound-send-policy";
import { domainIsSendingReady } from "../../shared/ses-dns";

const NEWSLETTER_BLAST_HARD_CAP = 500;
const CSV_IMPORT_HARD_CAP = 500;

type SettingsRow = {
  user_id: string;
  from_name: string;
  physical_address: string;
  mailbox_id: string;
  public_slug: string;
  double_opt_in: number;
  updated_at: number;
};

type SubscriberRow = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  status: string;
  created_at: number;
  confirm_token?: string;
  unsub_token?: string;
};

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatFrom(address: string, name?: string): string {
  const n = (name || "").trim().replace(/[\r\n"]/g, "");
  if (!n) return address;
  return `"${n}" <${address}>`;
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function defaultSlug(db: D1Database, userId: string): Promise<string> {
  const user = await db.prepare("SELECT email FROM users WHERE id = ?").bind(userId).first<{ email: string }>();
  const local = (user?.email || "list").split("@")[0] || "list";
  let base = slugify(local) || "list";
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base}-${randomId("").slice(0, 4)}`;
    const taken = await db
      .prepare("SELECT user_id FROM newsletter_settings WHERE public_slug = ? AND user_id != ?")
      .bind(candidate, userId)
      .first();
    if (!taken) return candidate;
  }
  return `${base}-${randomId("").slice(0, 6)}`;
}

async function loadSettings(db: D1Database, userId: string): Promise<SettingsRow> {
  const existing = await db
    .prepare(
      `SELECT user_id, from_name, physical_address, mailbox_id, public_slug, double_opt_in, updated_at
       FROM newsletter_settings WHERE user_id = ?`,
    )
    .bind(userId)
    .first<SettingsRow>()
    .catch(() => null);
  if (existing) {
    if (!existing.public_slug) {
      const slug = await defaultSlug(db, userId);
      await db
        .prepare("UPDATE newsletter_settings SET public_slug = ?, updated_at = ? WHERE user_id = ?")
        .bind(slug, nowMs(), userId)
        .run()
        .catch(() => undefined);
      return { ...existing, public_slug: slug };
    }
    return existing;
  }
  const slug = await defaultSlug(db, userId);
  const row: SettingsRow = {
    user_id: userId,
    from_name: "",
    physical_address: "",
    mailbox_id: "",
    public_slug: slug,
    double_opt_in: 1,
    updated_at: nowMs(),
  };
  await db
    .prepare(
      `INSERT INTO newsletter_settings (user_id, from_name, physical_address, mailbox_id, public_slug, double_opt_in, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.user_id, row.from_name, row.physical_address, row.mailbox_id, row.public_slug, row.double_opt_in, row.updated_at)
    .run()
    .catch(() => undefined);
  return row;
}

async function ensureSubscriberTokens(db: D1Database, sub: SubscriberRow): Promise<SubscriberRow> {
  let confirm = (sub.confirm_token || "").trim();
  let unsub = (sub.unsub_token || "").trim();
  if (confirm && unsub) return { ...sub, confirm_token: confirm, unsub_token: unsub };
  if (!confirm) confirm = randomId("nct");
  if (!unsub) unsub = randomId("nut");
  await db
    .prepare("UPDATE newsletter_subscribers SET confirm_token = ?, unsub_token = ? WHERE id = ?")
    .bind(confirm, unsub, sub.id)
    .run()
    .catch(() => undefined);
  return { ...sub, confirm_token: confirm, unsub_token: unsub };
}

async function resolveMailbox(
  db: D1Database,
  userId: string,
  preferredId?: string,
): Promise<{ id: string; address: string; display_name: string; domain_id: string } | null> {
  if (preferredId) {
    const row = await db
      .prepare("SELECT id, address, display_name, domain_id FROM mailboxes WHERE id = ? AND user_id = ?")
      .bind(preferredId, userId)
      .first<{ id: string; address: string; display_name: string; domain_id: string }>();
    if (row) return row;
  }
  return db
    .prepare("SELECT id, address, display_name, domain_id FROM mailboxes WHERE user_id = ? ORDER BY created_at ASC LIMIT 1")
    .bind(userId)
    .first<{ id: string; address: string; display_name: string; domain_id: string }>();
}

function blastFooter(opts: { physicalAddress: string; unsubUrl: string; from: string }): { html: string; text: string } {
  const addr = opts.physicalAddress.trim() || "Address on file with the sender";
  const html = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2dfd8;font-size:12px;line-height:1.5;color:#7a756d">
<p style="margin:0 0 8px">You received this because you subscribed to ${escapeHtml(opts.from)}.</p>
<p style="margin:0 0 8px">${escapeHtml(addr)}</p>
<p style="margin:0"><a href="${escapeHtml(opts.unsubUrl)}" style="color:#64615a">Unsubscribe</a></p>
</div>`;
  const text = `\n\n—\nYou received this because you subscribed to ${opts.from}.\n${addr}\nUnsubscribe: ${opts.unsubUrl}\n`;
  return { html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapHtml(body: string, footerHtml: string): string {
  if (/<\/body>/i.test(body)) return body.replace(/<\/body>/i, `${footerHtml}</body>`);
  return `${body}${footerHtml}`;
}

function parseCsvSubscribers(csv: string): Array<{ email: string; name: string }> {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const first = splitCsvLine(lines[0]);
  const header = first.map((h) => h.toLowerCase());
  const emailIdx = header.findIndex((h) => h === "email" || h === "e-mail" || h === "address");
  const nameIdx = header.findIndex((h) => h === "name" || h === "full name" || h === "fullname");
  const hasHeader = emailIdx >= 0;
  const start = hasHeader ? 1 : 0;
  const out: Array<{ email: string; name: string }> = [];
  const seen = new Set<string>();
  for (let i = start; i < lines.length && out.length < CSV_IMPORT_HARD_CAP; i++) {
    const cols = splitCsvLine(lines[i]);
    const emailRaw = hasHeader ? cols[emailIdx] || "" : cols[0] || "";
    const email = extractEmail(emailRaw).toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    const name = (hasHeader && nameIdx >= 0 ? cols[nameIdx] : cols[1] || "").trim().slice(0, 120);
    out.push({ email, name });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cols.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

async function sendTransactional(
  env: Env,
  opts: { from: string; to: string; subject: string; html: string; text: string },
): Promise<boolean> {
  if (!canSendMail(env)) return false;
  try {
    const raw = buildRawMime({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    await sendRawEmail(env, { envelopeFrom: extractEmail(opts.from), recipients: [opts.to], rawMime: raw });
    return true;
  } catch (err) {
    console.warn("Newsletter transactional send failed", opts.to, err);
    return false;
  }
}

async function sendConfirmEmail(
  env: Env,
  opts: { mailbox: { address: string; display_name: string }; fromName: string; to: string; confirmUrl: string },
): Promise<boolean> {
  const from = formatFrom(opts.mailbox.address, opts.fromName || opts.mailbox.display_name);
  const html = `<p>Confirm your subscription to ${escapeHtml(opts.mailbox.address)}.</p>
<p><a href="${escapeHtml(opts.confirmUrl)}">Confirm subscription</a></p>
<p>If you did not request this, ignore this email.</p>`;
  return sendTransactional(env, {
    from,
    to: opts.to,
    subject: "Confirm your subscription",
    html,
    text: `Confirm your subscription:\n${opts.confirmUrl}\n`,
  });
}

export async function unsubscribeNewsletterEmail(db: D1Database, email: string, now = nowMs()): Promise<void> {
  const addr = extractEmail(email).toLowerCase();
  if (!addr) return;
  await db
    .prepare(
      `UPDATE newsletter_subscribers
       SET status = 'unsubscribed', unsubscribed_at = ?
       WHERE email = ? AND status != 'unsubscribed'`,
    )
    .bind(now, addr)
    .run()
    .catch(() => undefined);
}

export async function processQueuedNewsletterBlasts(env: Env): Promise<void> {
  const now = nowMs();
  const queued = await env.DB.prepare(
    `SELECT id, user_id, domain_id, mailbox_id, subject, html_body, from_name, scheduled_at
     FROM newsletter_blasts
     WHERE status IN ('queued', 'scheduled')
       AND (scheduled_at IS NULL OR scheduled_at <= ?)
     ORDER BY created_at ASC
     LIMIT 5`,
  )
    .bind(now)
    .all<{
      id: string;
      user_id: string;
      domain_id: string;
      mailbox_id: string;
      subject: string;
      html_body: string;
      from_name: string;
      scheduled_at: number | null;
    }>()
    .catch(() => ({ results: [] as Array<{
      id: string;
      user_id: string;
      domain_id: string;
      mailbox_id: string;
      subject: string;
      html_body: string;
      from_name: string;
      scheduled_at: number | null;
    }> }));

  const origin = appOrigin(env);

  for (const blast of queued.results ?? []) {
    await env.DB.prepare("UPDATE newsletter_blasts SET status = 'sending' WHERE id = ? AND status IN ('queued', 'scheduled')")
      .bind(blast.id)
      .run()
      .catch(() => undefined);

    const plan = await getEffectivePlan(env.DB, blast.user_id);
    const cap = Math.min(
      NEWSLETTER_BLAST_HARD_CAP,
      plan.limits.newsletter_sends_per_month || NEWSLETTER_BLAST_HARD_CAP,
    );
    const settings = await loadSettings(env.DB, blast.user_id);

    const subs = await env.DB.prepare(
      `SELECT id, user_id, email, name, status, created_at, confirm_token, unsub_token
       FROM newsletter_subscribers
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at ASC
       LIMIT ?`,
    )
      .bind(blast.user_id, cap)
      .all<SubscriberRow>()
      .catch(() => ({ results: [] as SubscriberRow[] }));

    const recipients = subs.results ?? [];
    if (!recipients.length) {
      await env.DB.prepare(
        "UPDATE newsletter_blasts SET status = 'sent', capped_count = 0, sent_at = ? WHERE id = ?",
      )
        .bind(now, blast.id)
        .run()
        .catch(() => undefined);
      continue;
    }

    const mailbox = await resolveMailbox(env.DB, blast.user_id, blast.mailbox_id || settings.mailbox_id);
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

    const fromDomain = extractEmail(mailbox.address).split("@")[1]?.toLowerCase() || "";
    const domainRow = fromDomain
      ? await env.DB.prepare(
          `SELECT mail_provider, provider_state, identity_verified_at, mx_verified_at,
                  inbound_rule_ready_at, receiving_ready_at, sending_ready_at
           FROM domains WHERE user_id = ? AND lower(name) = ? LIMIT 1`,
        )
          .bind(blast.user_id, fromDomain)
          .first<{
            mail_provider: string | null;
            provider_state: string | null;
            identity_verified_at: number | null;
            mx_verified_at: number | null;
            inbound_rule_ready_at: number | null;
            receiving_ready_at: number | null;
            sending_ready_at: number | null;
          }>()
      : null;
    const domainPolicy = evaluateOutboundDomainPolicy(fromDomain || "unknown", domainRow);
    if (domainPolicy || (domainRow && !domainIsSendingReady(domainRow))) {
      await env.DB.prepare(
        "UPDATE newsletter_blasts SET status = 'failed', capped_count = 0 WHERE id = ?",
      )
        .bind(blast.id)
        .run()
        .catch(() => undefined);
      console.warn("Newsletter blast skipped — domain not sending-ready", blast.id, domainPolicy?.message);
      continue;
    }

    const fromName = (blast.from_name || settings.from_name || mailbox.display_name || "").trim();
    const fromHeader = formatFrom(mailbox.address, fromName);
    let sent = 0;

    for (const rawSub of recipients) {
      const sendLimit = await assertSendRoom(env.DB, blast.user_id);
      if (!sendLimit.ok) break;
      const to = extractEmail(rawSub.email).toLowerCase();
      if (!EMAIL_RE.test(to)) continue;
      if (await isAddressSuppressed(env.DB, blast.user_id, to)) {
        await unsubscribeNewsletterEmail(env.DB, to, now);
        continue;
      }
      const sub = await ensureSubscriberTokens(env.DB, rawSub);
      const unsubUrl = `${origin}/n/u/${sub.unsub_token}`;
      const apiUnsub = `${origin}/api/public/n/unsubscribe/${sub.unsub_token}`;
      const footer = blastFooter({
        physicalAddress: settings.physical_address,
        unsubUrl,
        from: mailbox.address,
      });
      const html = wrapHtml(blast.html_body || "<p></p>", footer.html);
      const text = `${htmlToText(blast.html_body || "")}${footer.text}`;
      try {
        const raw = buildRawMime({
          from: fromHeader,
          to,
          subject: blast.subject || "(no subject)",
          text,
          html,
          listUnsubscribe: apiUnsub,
        });
        await sendRawEmail(env, {
          envelopeFrom: mailbox.address,
          recipients: [to],
          rawMime: raw,
        });
        await recordOutboundSend(env.DB, blast.user_id);
        sent += 1;
        await env.DB.prepare(
          `INSERT INTO newsletter_send_events (id, blast_id, subscriber_id, email, status, error, created_at)
           VALUES (?, ?, ?, ?, 'sent', '', ?)`,
        )
          .bind(randomId("nse"), blast.id, sub.id, to, now)
          .run()
          .catch(() => undefined);
      } catch (err) {
        console.warn("Newsletter recipient failed", blast.id, to, err);
        await env.DB.prepare(
          `INSERT INTO newsletter_send_events (id, blast_id, subscriber_id, email, status, error, created_at)
           VALUES (?, ?, ?, ?, 'failed', ?, ?)`,
        )
          .bind(randomId("nse"), blast.id, sub.id, to, String(err instanceof Error ? err.message : err).slice(0, 300), now)
          .run()
          .catch(() => undefined);
      }
    }

    await env.DB.prepare(
      "UPDATE newsletter_blasts SET status = 'sent', capped_count = ?, sent_at = ? WHERE id = ?",
    )
      .bind(sent, now, blast.id)
      .run()
      .catch(() => undefined);
  }
}

export function registerNewsletterRoutes(app: Hono<AppEnv>) {
  app.get("/api/newsletters", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    const settings = await loadSettings(c.env.DB, ctx.workspaceId);
    const rows = await c.env.DB.prepare(
      `SELECT id, subject, status, capped_count, created_at, mailbox_id, scheduled_at, from_name, domain_id
       FROM newsletter_blasts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    )
      .bind(ctx.workspaceId)
      .all()
      .catch(() => ({ results: [] }));
    const counts = await c.env.DB.prepare(
      `SELECT
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_n,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_n,
         COUNT(*) AS total_n
       FROM newsletter_subscribers WHERE user_id = ?`,
    )
      .bind(ctx.workspaceId)
      .first<{ active_n: number; pending_n: number; total_n: number }>()
      .catch(() => ({ active_n: 0, pending_n: 0, total_n: 0 }));
    const mailboxes = await c.env.DB.prepare(
      "SELECT id, address, display_name, domain_id FROM mailboxes WHERE user_id = ? ORDER BY created_at ASC",
    )
      .bind(ctx.workspaceId)
      .all()
      .catch(() => ({ results: [] }));
    const origin = appOrigin(c.env);
    return c.json({
      items: rows.results ?? [],
      settings,
      mailboxes: mailboxes.results ?? [],
      caps: {
        sends_per_month: plan.limits.newsletter_sends_per_month ?? 0,
        subscribers: plan.limits.newsletter_subscribers ?? 0,
      },
      audience_count: Number(counts?.active_n ?? 0),
      pending_count: Number(counts?.pending_n ?? 0),
      subscriber_total: Number(counts?.total_n ?? 0),
      plan_ok: planAtLeast(plan.plan_id, "solo"),
      plan_id: plan.plan_id,
      signup_url: settings.public_slug ? `${origin}/n/${settings.public_slug}` : "",
    });
  });

  app.put("/api/newsletters/settings", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Newsletters require Solo or higher." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as {
      from_name?: string;
      physical_address?: string;
      mailbox_id?: string;
      public_slug?: string;
      double_opt_in?: boolean;
    };
    const current = await loadSettings(c.env.DB, ctx.workspaceId);
    let slug = current.public_slug;
    if (typeof body.public_slug === "string") {
      const next = slugify(body.public_slug);
      if (!next) return c.json({ error: "Public signup slug is required." }, 400);
      const taken = await c.env.DB.prepare(
        "SELECT user_id FROM newsletter_settings WHERE public_slug = ? AND user_id != ?",
      )
        .bind(next, ctx.workspaceId)
        .first();
      if (taken) return c.json({ error: "That signup URL is taken." }, 409);
      slug = next;
    }
    const mailboxId = typeof body.mailbox_id === "string" ? body.mailbox_id : current.mailbox_id;
    if (mailboxId) {
      const mb = await resolveMailbox(c.env.DB, ctx.workspaceId, mailboxId);
      if (!mb) return c.json({ error: "Mailbox not found." }, 400);
    }
    const row: SettingsRow = {
      user_id: ctx.workspaceId,
      from_name: (body.from_name ?? current.from_name).trim().slice(0, 80),
      physical_address: (body.physical_address ?? current.physical_address).trim().slice(0, 240),
      mailbox_id: mailboxId || "",
      public_slug: slug,
      double_opt_in: body.double_opt_in === undefined ? current.double_opt_in : body.double_opt_in ? 1 : 0,
      updated_at: nowMs(),
    };
    await c.env.DB.prepare(
      `INSERT INTO newsletter_settings (user_id, from_name, physical_address, mailbox_id, public_slug, double_opt_in, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         from_name = excluded.from_name,
         physical_address = excluded.physical_address,
         mailbox_id = excluded.mailbox_id,
         public_slug = excluded.public_slug,
         double_opt_in = excluded.double_opt_in,
         updated_at = excluded.updated_at`,
    )
      .bind(row.user_id, row.from_name, row.physical_address, row.mailbox_id, row.public_slug, row.double_opt_in, row.updated_at)
      .run();
    const origin = appOrigin(c.env);
    return c.json({ settings: row, signup_url: `${origin}/n/${row.public_slug}` });
  });

  app.get("/api/newsletters/subscribers", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const rows = await c.env.DB.prepare(
      `SELECT id, email, name, status, created_at
       FROM newsletter_subscribers WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 500`,
    )
      .bind(ctx.workspaceId)
      .all()
      .catch(() => ({ results: [] }));
    return c.json({ subscribers: rows.results ?? [] });
  });

  app.post("/api/newsletters/subscribers", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Newsletters require Solo or higher." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { email?: string; name?: string; consented?: boolean };
    const email = extractEmail(body.email || "").toLowerCase();
    if (!EMAIL_RE.test(email)) return c.json({ error: "Valid email required." }, 400);
    const settings = await loadSettings(c.env.DB, ctx.workspaceId);
    const consented = body.consented !== false;
    const status = consented || !settings.double_opt_in ? "active" : "pending";
    if (status === "active") {
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
    }
    const id = randomId("nsub");
    const confirm = randomId("nct");
    const unsub = randomId("nut");
    const now = nowMs();
    try {
      await c.env.DB.prepare(
        `INSERT INTO newsletter_subscribers (id, user_id, email, name, status, created_at, confirm_token, unsub_token, confirmed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, ctx.workspaceId, email, (body.name || "").trim().slice(0, 120), status, now, confirm, unsub, status === "active" ? now : null)
        .run();
    } catch {
      return c.json({ error: "That email is already on this audience." }, 409);
    }
    if (status === "pending") {
      const mailbox = await resolveMailbox(c.env.DB, ctx.workspaceId, settings.mailbox_id);
      if (mailbox) {
        await sendConfirmEmail(c.env, {
          mailbox,
          fromName: settings.from_name,
          to: email,
          confirmUrl: `${appOrigin(c.env)}/n/c/${confirm}`,
        });
      }
    }
    return c.json({ subscriber: { id, email, name: (body.name || "").trim(), status } }, 201);
  });

  app.post("/api/newsletters/subscribers/import", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Newsletters require Solo or higher." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { csv?: string; consented?: boolean };
    const rows = parseCsvSubscribers(body.csv || "");
    if (!rows.length) return c.json({ error: "No valid emails found. Use a CSV with an email column." }, 400);
    const settings = await loadSettings(c.env.DB, ctx.workspaceId);
    const consented = body.consented !== false;
    const status = consented || !settings.double_opt_in ? "active" : "pending";
    const count = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE user_id = ? AND status = 'active'",
    )
      .bind(ctx.workspaceId)
      .first<{ n: number }>()
      .catch(() => ({ n: 0 }));
    const max = plan.limits.newsletter_subscribers ?? 0;
    const room = max > 0 ? Math.max(0, max - Number(count?.n ?? 0)) : rows.length;
    const now = nowMs();
    let imported = 0;
    let skipped = 0;
    const mailbox = status === "pending" ? await resolveMailbox(c.env.DB, ctx.workspaceId, settings.mailbox_id) : null;
    const origin = appOrigin(c.env);
    for (const row of rows) {
      if (status === "active" && imported >= room) {
        skipped += 1;
        continue;
      }
      const id = randomId("nsub");
      const confirm = randomId("nct");
      const unsub = randomId("nut");
      try {
        await c.env.DB.prepare(
          `INSERT INTO newsletter_subscribers (id, user_id, email, name, status, created_at, confirm_token, unsub_token, confirmed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(id, ctx.workspaceId, row.email, row.name, status, now, confirm, unsub, status === "active" ? now : null)
          .run();
        imported += 1;
        if (status === "pending" && mailbox) {
          await sendConfirmEmail(c.env, {
            mailbox,
            fromName: settings.from_name,
            to: row.email,
            confirmUrl: `${origin}/n/c/${confirm}`,
          });
        }
      } catch {
        skipped += 1;
      }
    }
    return c.json({ imported, skipped, status }, 201);
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
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Newsletters require Solo or higher." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as {
      subject?: string;
      html_body?: string;
      domain_id?: string;
      mailbox_id?: string;
      from_name?: string;
      queue?: boolean;
      scheduled_at?: number | null;
    };
    const subject = (body.subject || "").trim().slice(0, 200);
    if (!subject) return c.json({ error: "subject required." }, 400);
    const settings = await loadSettings(c.env.DB, ctx.workspaceId);
    const scheduledAt = typeof body.scheduled_at === "number" && body.scheduled_at > nowMs() ? body.scheduled_at : null;
    let status = "draft";
    if (body.queue && scheduledAt) status = "scheduled";
    else if (body.queue) status = "queued";
    if (status !== "draft") {
      if (!settings.physical_address.trim()) {
        return c.json({ error: "Add a physical mailing address in newsletter settings before sending (CAN-SPAM)." }, 400);
      }
    }
    const mailbox = await resolveMailbox(c.env.DB, ctx.workspaceId, body.mailbox_id || settings.mailbox_id);
    const id = randomId("nl");
    await c.env.DB.prepare(
      `INSERT INTO newsletter_blasts (id, user_id, domain_id, subject, html_body, recipient_tag, status, capped_count, created_at, mailbox_id, scheduled_at, from_name)
       VALUES (?, ?, ?, ?, ?, '', ?, 0, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        ctx.workspaceId,
        body.domain_id || mailbox?.domain_id || "",
        subject,
        (body.html_body || "").slice(0, 200_000),
        status,
        nowMs(),
        mailbox?.id || "",
        scheduledAt,
        (body.from_name || settings.from_name || "").slice(0, 80),
      )
      .run();
    return c.json({ item: { id, subject, status, scheduled_at: scheduledAt } }, 201);
  });

  app.get("/api/newsletters/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const id = c.req.param("id");
    if (id === "subscribers" || id === "settings") return c.json({ error: "Not found." }, 404);
    const item = await c.env.DB.prepare(
      `SELECT id, subject, html_body, status, capped_count, created_at, mailbox_id, scheduled_at, from_name, domain_id
       FROM newsletter_blasts WHERE id = ? AND user_id = ?`,
    )
      .bind(c.req.param("id"), ctx.workspaceId)
      .first();
    if (!item) return c.json({ error: "Newsletter not found." }, 404);
    return c.json({ item });
  });

  app.patch("/api/newsletters/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const existing = await c.env.DB.prepare(
      "SELECT id, status FROM newsletter_blasts WHERE id = ? AND user_id = ?",
    )
      .bind(c.req.param("id"), ctx.workspaceId)
      .first<{ id: string; status: string }>();
    if (!existing) return c.json({ error: "Newsletter not found." }, 404);
    if (existing.status !== "draft" && existing.status !== "failed") {
      return c.json({ error: "Only drafts can be edited." }, 400);
    }
    const body = (await c.req.json().catch(() => ({}))) as {
      subject?: string;
      html_body?: string;
      mailbox_id?: string;
      from_name?: string;
      scheduled_at?: number | null;
    };
    const subject = (body.subject || "").trim().slice(0, 200);
    if (!subject) return c.json({ error: "subject required." }, 400);
    const scheduledAt = typeof body.scheduled_at === "number" && body.scheduled_at > nowMs() ? body.scheduled_at : null;
    await c.env.DB.prepare(
      `UPDATE newsletter_blasts
       SET subject = ?, html_body = ?, mailbox_id = COALESCE(NULLIF(?, ''), mailbox_id),
           from_name = ?, scheduled_at = ?
       WHERE id = ? AND user_id = ?`,
    )
      .bind(
        subject,
        (body.html_body || "").slice(0, 200_000),
        body.mailbox_id || "",
        (body.from_name || "").slice(0, 80),
        scheduledAt,
        existing.id,
        ctx.workspaceId,
      )
      .run();
    return c.json({ ok: true, item: { id: existing.id, subject, status: existing.status, scheduled_at: scheduledAt } });
  });

  app.delete("/api/newsletters/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const res = await c.env.DB.prepare(
      `DELETE FROM newsletter_blasts WHERE id = ? AND user_id = ? AND status IN ('draft', 'failed')`,
    )
      .bind(c.req.param("id"), ctx.workspaceId)
      .run()
      .catch(() => ({ meta: { changes: 0 } }));
    if (!res.meta.changes) return c.json({ error: "Only drafts or failed sends can be deleted." }, 404);
    return c.json({ ok: true });
  });

  app.post("/api/newsletters/:id/queue", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const settings = await loadSettings(c.env.DB, ctx.workspaceId);
    if (!settings.physical_address.trim()) {
      return c.json({ error: "Add a physical mailing address in newsletter settings before sending (CAN-SPAM)." }, 400);
    }
    const body = (await c.req.json().catch(() => ({}))) as { scheduled_at?: number | null };
    const scheduledAt = typeof body.scheduled_at === "number" && body.scheduled_at > nowMs() ? body.scheduled_at : null;
    const status = scheduledAt ? "scheduled" : "queued";
    const res = await c.env.DB.prepare(
      `UPDATE newsletter_blasts SET status = ?, scheduled_at = ?
       WHERE id = ? AND user_id = ? AND status IN ('draft', 'failed', 'scheduled')`,
    )
      .bind(status, scheduledAt, c.req.param("id"), ctx.workspaceId)
      .run()
      .catch(() => ({ meta: { changes: 0 } }));
    if (!res.meta.changes) return c.json({ error: "Draft not found or already sending." }, 404);
    return c.json({
      ok: true,
      status,
      scheduled_at: scheduledAt,
      note: scheduledAt ? "Will send at the scheduled time." : "Cron will process this blast shortly.",
    });
  });

  app.post("/api/newsletter/one-shot", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "team")) return c.json({ error: "One-shot newsletter requires Team." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as {
      domain_id?: string;
      mailbox_id?: string;
      subject?: string;
      html_body?: string;
      confirm_double_opt_in?: boolean;
    };
    if (!body.confirm_double_opt_in) {
      return c.json({ error: "Double opt-in confirmation required." }, 400);
    }
    const settings = await loadSettings(c.env.DB, ctx.workspaceId);
    if (!settings.physical_address.trim()) {
      return c.json({ error: "Add a physical mailing address before sending." }, 400);
    }
    const mailbox = await resolveMailbox(c.env.DB, ctx.workspaceId, body.mailbox_id || settings.mailbox_id);
    const id = randomId("blast");
    await c.env.DB.prepare(
      `INSERT INTO newsletter_blasts (id, user_id, domain_id, subject, html_body, recipient_tag, status, capped_count, created_at, mailbox_id, from_name)
       VALUES (?, ?, ?, ?, ?, 'one-shot', 'queued', 0, ?, ?, ?)`,
    )
      .bind(
        id,
        ctx.workspaceId,
        body.domain_id || mailbox?.domain_id || "",
        (body.subject || "").slice(0, 200),
        (body.html_body || "").slice(0, 100_000),
        nowMs(),
        mailbox?.id || "",
        settings.from_name,
      )
      .run();
    return c.json({ blast: { id, status: "queued" }, hard_cap: NEWSLETTER_BLAST_HARD_CAP }, 201);
  });

  async function applyUnsubscribe(c: { env: Env; req: { param: (k: string) => string } }) {
    const token = (c.req.param("token") || "").trim();
    if (!token) return { error: "Invalid link.", status: 400 as const };
    const sub = await c.env.DB.prepare(
      "SELECT id, email, status FROM newsletter_subscribers WHERE unsub_token = ?",
    )
      .bind(token)
      .first<{ id: string; email: string; status: string }>();
    if (!sub) return { error: "This unsubscribe link is invalid.", status: 404 as const };
    await c.env.DB.prepare(
      "UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = ? WHERE id = ?",
    )
      .bind(nowMs(), sub.id)
      .run();
    return { ok: true as const, email: sub.email };
  }

  app.get("/api/public/n/confirm/:token", async (c) => {
    const token = (c.req.param("token") || "").trim();
    if (!token) return c.json({ error: "Invalid link." }, 400);
    const sub = await c.env.DB.prepare(
      "SELECT id, email, status FROM newsletter_subscribers WHERE confirm_token = ?",
    )
      .bind(token)
      .first<{ id: string; email: string; status: string }>();
    if (!sub) return c.json({ error: "This confirmation link is invalid or expired." }, 404);
    if (sub.status === "unsubscribed") {
      return c.json({ error: "This address is unsubscribed." }, 400);
    }
    await c.env.DB.prepare(
      "UPDATE newsletter_subscribers SET status = 'active', confirmed_at = ? WHERE id = ?",
    )
      .bind(nowMs(), sub.id)
      .run();
    return c.json({ ok: true, email: sub.email, status: "active" });
  });

  app.get("/api/public/n/unsubscribe/:token", async (c) => {
    const token = (c.req.param("token") || "").trim();
    const sub = await c.env.DB.prepare(
      "SELECT email, status FROM newsletter_subscribers WHERE unsub_token = ?",
    )
      .bind(token)
      .first<{ email: string; status: string }>();
    if (!sub) return c.json({ error: "This unsubscribe link is invalid." }, 404);
    return c.json({ email: sub.email, status: sub.status });
  });

  app.post("/api/public/n/unsubscribe/:token", async (c) => {
    const result = await applyUnsubscribe(c);
    if ("error" in result) return c.json({ error: result.error }, result.status);
    return c.json({ ok: true, email: result.email });
  });

  app.get("/api/public/n/:slug", async (c) => {
    const slug = slugify(c.req.param("slug") || "");
    if (!slug || slug === "confirm" || slug === "unsubscribe") return c.json({ error: "Not found." }, 404);
    const settings = await c.env.DB.prepare(
      "SELECT user_id, from_name, public_slug FROM newsletter_settings WHERE public_slug = ?",
    )
      .bind(slug)
      .first<{ user_id: string; from_name: string; public_slug: string }>();
    if (!settings) return c.json({ error: "This signup page is not available." }, 404);
    const mailbox = await resolveMailbox(c.env.DB, settings.user_id, undefined);
    return c.json({
      slug: settings.public_slug,
      from_name: settings.from_name || mailbox?.display_name || "Newsletter",
      from_address: mailbox?.address || "",
    });
  });

  app.post("/api/public/n/:slug/subscribe", async (c) => {
    const slug = slugify(c.req.param("slug") || "");
    const settings = await c.env.DB.prepare(
      `SELECT user_id, from_name, mailbox_id, double_opt_in, physical_address
       FROM newsletter_settings WHERE public_slug = ?`,
    )
      .bind(slug)
      .first<SettingsRow>();
    if (!settings) return c.json({ error: "This signup page is not available." }, 404);
    const plan = await getEffectivePlan(c.env.DB, settings.user_id);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "This list is not accepting signups." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { email?: string; name?: string };
    const email = extractEmail(body.email || "").toLowerCase();
    if (!EMAIL_RE.test(email)) return c.json({ error: "Valid email required." }, 400);
    const existing = await c.env.DB.prepare(
      "SELECT id, status FROM newsletter_subscribers WHERE user_id = ? AND email = ?",
    )
      .bind(settings.user_id, email)
      .first<{ id: string; status: string }>();
    if (existing?.status === "active") {
      return c.json({ ok: true, status: "active", message: "You are already subscribed." });
    }
    if (existing?.status === "pending") {
      return c.json({ ok: true, status: "pending", message: "Check your inbox to confirm." });
    }
    const count = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE user_id = ? AND status = 'active'",
    )
      .bind(settings.user_id)
      .first<{ n: number }>()
      .catch(() => ({ n: 0 }));
    const max = plan.limits.newsletter_subscribers ?? 0;
    if (max > 0 && Number(count?.n ?? 0) >= max) {
      return c.json({ error: "This list is full." }, 402);
    }
    const doi = settings.double_opt_in !== 0;
    const status = doi ? "pending" : "active";
    const id = randomId("nsub");
    const confirm = randomId("nct");
    const unsub = randomId("nut");
    const now = nowMs();
    if (existing) {
      await c.env.DB.prepare(
        `UPDATE newsletter_subscribers
         SET status = ?, name = ?, confirm_token = ?, unsub_token = ?, confirmed_at = ?, unsubscribed_at = NULL
         WHERE id = ?`,
      )
        .bind(status, (body.name || "").trim().slice(0, 120), confirm, unsub, status === "active" ? now : null, existing.id)
        .run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO newsletter_subscribers (id, user_id, email, name, status, created_at, confirm_token, unsub_token, confirmed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, settings.user_id, email, (body.name || "").trim().slice(0, 120), status, now, confirm, unsub, status === "active" ? now : null)
        .run();
    }
    if (status === "pending") {
      const mailbox = await resolveMailbox(c.env.DB, settings.user_id, settings.mailbox_id);
      if (!mailbox) return c.json({ error: "This list cannot send confirmation email yet." }, 503);
      const sent = await sendConfirmEmail(c.env, {
        mailbox,
        fromName: settings.from_name,
        to: email,
        confirmUrl: `${appOrigin(c.env)}/n/c/${confirm}`,
      });
      if (!sent) return c.json({ error: "Could not send confirmation email. Try again later." }, 503);
      return c.json({ ok: true, status: "pending", message: "Check your inbox to confirm." }, 201);
    }
    return c.json({ ok: true, status: "active", message: "You are subscribed." }, 201);
  });
}
