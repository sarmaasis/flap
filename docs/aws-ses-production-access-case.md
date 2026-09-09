# AWS SES production-access case (editable)

**Use only after production deploy is verified.** Reply to the existing denial case first if AWS still accepts replies.

Replace bracketed fields. Do **not** paste secrets.

---

Hello AWS SES Trust & Safety / Support team,

I am requesting reconsideration of Amazon SES production access for Flap (https://useflap.online) in **[AWS REGION]**.

Flap is a hosted business-email platform for founders, agencies, studios, and small teams managing custom domains that they own or are authorized to operate.

The primary use case is normal business and application email such as:

- support@customer-domain.com
- hello@customer-domain.com
- billing@customer-domain.com
- legitimate transactional application notifications

Flap is not an anonymous bulk-email relay and does not permit arbitrary sender domains.

Every customer must authenticate to Flap and complete DNS/domain verification before outbound sending is enabled. Outbound sender identities must belong to domains that are verified and ready for sending.

Since the original production-access request, we have implemented and verified the following controls **[only keep bullets that are live in production]**:

- authenticated customer workspaces;
- DNS-based sending-domain verification;
- DKIM/domain readiness checks;
- server-side sender identity enforcement;
- centralized outbound authorization and sending policy;
- per-workspace/plan sending limits;
- workspace-scoped bounce and complaint attribution;
- suppression handling that prevents repeated sends to suppressed recipients;
- delivery, bounce, complaint, rejection, and other delivery-event processing **[only if SES configuration set + SNS → https://useflap.online/api/inbound/ses/events is live]**;
- domain/workspace suspension capability;
- anti-abuse and acceptable-use policies;
- prohibition of purchased, scraped, harvested, and unsolicited bulk recipient lists;
- audit/security controls for multi-tenant workspace isolation.

Recipients primarily fall into two categories:

1. People directly communicating with our customers through their business email addresses, where Flap is providing normal mailbox/reply functionality.

2. Users of our customers' applications receiving legitimate transactional messages such as account, authentication, billing, support, purchase, or service notifications.

Marketing/broadcast messages, where enabled, may only be sent to recipients for whom the customer has an appropriate permission/consent basis. Purchased, scraped, harvested, or unsolicited recipient lists are prohibited.

For inbound mail, Flap uses Amazon SES receipt processing with private raw-message storage, durable queue/retry processing, and authenticated ingest into the application.

For outbound mail, sending passes through a centralized authorization/readiness policy before SES. **[If events are live:]** SES delivery events are processed and attributed to the correct Flap workspace so bounces and complaints can be handled and suppressed.

We will initially operate at low volume. Our expected initial volume is approximately:

**[INSERT REALISTIC MESSAGES/DAY OR MONTH]**

We will increase usage gradually as verified customers are onboarded.

Public information is available at:

- Website: https://useflap.online
- Security: https://useflap.online/security
- Privacy: https://useflap.online/privacy
- Terms: https://useflap.online/terms
- Acceptable Use: https://useflap.online/acceptable-use
- Abuse: https://useflap.online/abuse
- Status: https://useflap.online/status
- Documentation: https://useflap.online/docs

We understand the responsibility of operating a multi-tenant email platform on Amazon SES and the need to maintain low bounce/complaint rates and prevent abusive sending.

We would appreciate reconsideration of our production-access request. We are happy to provide additional technical details about domain verification, bounce/complaint processing, suppressions, recipient acquisition, sending controls, or our SES architecture if needed.

Thank you.

---

**Previous SES production access case:** [CASE ID]  
**Mail type if using the SES console form:** TRANSACTIONAL  
**Website:** https://useflap.online  
**Language:** English
