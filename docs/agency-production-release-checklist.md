# Agency production release checklist

## Before release

- [ ] Clean reviewed commit
- [ ] `npm run check` passes (includes agency suites)
- [ ] `0033` rehearsed locally; staging apply after duplicate/`0031` hygiene
- [ ] Actual-handler / agency IDOR tests pass
- [ ] Role escalation tests pass
- [ ] Invitation tests pass
- [ ] Offboarding tests pass
- [ ] Sender identity / scheduled revalidation tests pass
- [ ] Gmail/Outlook matrix — **not yet run**
- [ ] Bounce/suppression unit tests pass
- [ ] Remote image privacy (existing) passes
- [ ] Backup restore drill — **not yet run**
- [ ] Rollback documented
- [ ] Alerts active — **not wired in this repo**

## Post-deploy

- [ ] Owner login
- [ ] Invite admin + member
- [ ] Grant / revoke mailbox and domain
- [ ] Remove member; verify deny
- [ ] Shared mailbox send/receive + reply-from
- [ ] Attachment
- [ ] Audit events
- [ ] Delivery events scoped
- [ ] Logs/alerts
