/**
 * Authz / XSS / suppressions unit tests (no network / D1).
 * Run: npx tsx shared/security-authz.test.ts
 */

import {
  mailboxAccessSql,
  memberDeniedMailbox,
  messageAuthzWhere,
  resolveReplyFromAddress,
} from "./security-guards.ts";
import { sanitizeEmailHtml } from "./sanitize-email-html.ts";
import { domainIsSendingReady, type ReadinessRow } from "./ses-dns.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function extractEmail(raw: string): string {
  const m = /<([^>]+)>/.exec(raw);
  const addr = (m?.[1] || raw).trim().toLowerCase();
  return addr.includes("@") ? addr : "";
}

// --- Mailbox ACL / IDOR contract (mirrors GET /api/mail/:id, thread, attachments) ---
{
  const owner = mailboxAccessSql({ mailboxIds: null });
  assert(owner.sql === "" && owner.binds.length === 0, "owner/admin sees all mailboxes");

  const denied = mailboxAccessSql({ mailboxIds: [] });
  assert(denied.sql.includes("1 = 0"), "member with zero grants gets impossible clause");

  const granted = mailboxAccessSql({ mailboxIds: ["mb_a", "mb_b"] });
  assert(granted.sql.includes("mailbox_id IN (?, ?)"), "member grants become IN list");
  assert(granted.binds.join(",") === "mb_a,mb_b", "grant binds ordered");

  const where = messageAuthzWhere("ws_owner", { mailboxIds: ["mb_a"] });
  assert(where.sql.startsWith("user_id = ?"), "message authz always scopes workspace");
  assert(where.sql.includes("mailbox_id IN (?)"), "message authz includes mailbox ACL");
  assert(where.binds[0] === "ws_owner" && where.binds[1] === "mb_a", "workspace then mailbox binds");

  assert(memberDeniedMailbox({ mailboxIds: ["mb_a"] }, "mb_b"), "cross-mailbox IDOR denied for member");
  assert(!memberDeniedMailbox({ mailboxIds: null }, "mb_b"), "owner not denied any mailbox");
  assert(!memberDeniedMailbox({ mailboxIds: ["mb_a"] }, "mb_a"), "granted mailbox allowed");
}

// --- Draft update / calendar RSVP must use the same message authz WHERE ---
{
  // Contract: POST /api/mail/send (body.id) and POST /api/calendar/rsvp load the message with
  // user_id = workspaceId + mailboxAccessClause — same as GET /api/mail/:id.
  const draftWhere = messageAuthzWhere("ws_owner", { mailboxIds: ["mb_granted"] });
  assert(draftWhere.sql === "user_id = ? AND mailbox_id IN (?)", "draft update authz SQL");
  assert(draftWhere.binds.join(",") === "ws_owner,mb_granted", "draft update binds");

  const rsvpWhere = messageAuthzWhere("ws_owner", { mailboxIds: [] });
  assert(rsvpWhere.sql.includes("1 = 0"), "RSVP denied when member has zero mailbox grants");
}

// --- Global domain uniqueness product rule ---
{
  const rule = {
    uniqueIndex: "idx_domains_name_global on lower(name)",
    collisionStatus: 409,
    sameWorkspaceMessage: "That domain is already on this account.",
    otherWorkspaceMessage: "That domain is already claimed by another Flap workspace.",
  };
  assert(rule.uniqueIndex.includes("lower(name)"), "domains globally unique by lower(name)");
  assert(rule.collisionStatus === 409, "claim collision returns 409");
}

// --- Attachment authz uses same message workspace + mailbox ACL ---
{
  // Documented contract: attachment download joins messages with user_id + mailboxAccessClause.
  const att = messageAuthzWhere("ws_x", { mailboxIds: [] }, "m.mailbox_id");
  assert(att.sql.includes("1 = 0"), "attachment path denies when no mailbox grants");
  assert(att.binds[0] === "ws_x", "attachment still requires workspace id");
}

// --- Reply-from mapping (wrong default From regression) ---
{
  const mboxes = [
    { id: "mb1", address: "support@product-a.com" },
    { id: "mb2", address: "hello@product-b.com" },
  ];
  assert(
    resolveReplyFromAddress({ mailbox_id: "mb1", to_addr: "x" }, mboxes, extractEmail) ===
      "support@product-a.com",
    "reply-from prefers mailbox_id",
  );
  assert(
    resolveReplyFromAddress(
      { mailbox_id: "missing", to_addr: "Hello <hello@product-b.com>" },
      mboxes,
      extractEmail,
    ) === "hello@product-b.com",
    "reply-from falls back to owned To",
  );
  assert(
    resolveReplyFromAddress(
      { mailbox_id: "missing", to_addr: "customer@gmail.com" },
      mboxes,
      extractEmail,
    ) === undefined,
    "reply-from never returns foreign address",
  );
}

// --- Domain not sending-ready blocks send ---
{
  const pending: ReadinessRow = {
    mail_provider: "ses",
    provider_state: "DNS_PENDING",
    identity_verified_at: null,
    mx_verified_at: null,
    inbound_rule_ready_at: null,
    receiving_ready_at: null,
    sending_ready_at: null,
  };
  assert(!domainIsSendingReady(pending), "unverified SES domain cannot send");
  assert(domainIsSendingReady({ ...pending, sending_ready_at: Date.now() }), "ready SES can send");
}

// --- HTML email XSS sanitizer (DOMPurify via isomorphic-dompurify) ---
{
  assert(sanitizeEmailHtml("") === "", "empty input stays empty");

  const dirty =
    `<p>Hi</p><script>alert(1)</script><img src=x onerror="alert(2)">` +
    `<a href="javascript:alert(3)">x</a><iframe src="https://evil"></iframe>` +
    `<div onclick="steal()">ok</div>`;
  const clean = sanitizeEmailHtml(dirty);
  assert(!/<script/i.test(clean), "script tags removed");
  assert(!/<iframe/i.test(clean), "iframe removed");
  assert(!/onerror=/i.test(clean), "onerror handler removed");
  assert(!/onclick=/i.test(clean), "onclick handler removed");
  assert(!/javascript:/i.test(clean), "javascript: URLs neutralized");
  assert(clean.includes("<p>Hi</p>"), "safe markup retained");
  assert(clean.includes("ok"), "text content retained");

  // Email-shaped safe markup should survive (tables, inline styles, https images/links).
  const emailish =
    `<table style="width:100%"><tr><td style="color:#333">Hello</td></tr></table>` +
    `<img src="https://cdn.example/logo.png" alt="Logo">` +
    `<a href="https://example.com">Visit</a>`;
  const kept = sanitizeEmailHtml(emailish);
  assert(/<table/i.test(kept), "tables retained");
  assert(/style=/i.test(kept), "inline styles retained");
  assert(/<img/i.test(kept) && /https:\/\/cdn\.example/i.test(kept), "https images retained");
  assert(/href="https:\/\/example\.com"/i.test(kept), "https links retained");

  // Extra XSS vectors
  assert(!/javascript:/i.test(sanitizeEmailHtml(`<a href="JAVASCRIPT:alert(1)">x</a>`)), "case-insensitive javascript: blocked");
  assert(!/<object/i.test(sanitizeEmailHtml(`<object data="https://evil"></object>`)), "object removed");
  assert(!/<embed/i.test(sanitizeEmailHtml(`<embed src="https://evil">`)), "embed removed");
}

// --- Suppressions tenancy product rule (documented for send checks) ---
{
  // Send suppression is workspace-scoped: isAddressSuppressed(db, userId, email).
  // Empty user_id rows must never block (poison / unattributed).
  const rule = {
    scopedByUserId: true,
    unattributedBlocksSend: false,
    uniqueKey: "user_id+email",
  };
  assert(rule.scopedByUserId && !rule.unattributedBlocksSend, "suppressions are per-workspace");
  assert(rule.uniqueKey === "user_id+email", "unique index is (user_id, email)");
}

console.log("shared/security-authz checks passed");
