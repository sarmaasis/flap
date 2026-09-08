# Agency authorization matrix

Enforced **server-side** via `resolveWorkspace` + mailbox/domain grants. UI hiding is not sufficient.

**Contacts policy:** workspace-level shared address book (`user_id` = workspace owner id).  
**Templates / signatures / prefs:** remain personal (`session.user.id`).  
**Remote images:** user-specific Load images toggle — not workspace-wide.  
**Client groups:** navigation only — not an ACL.

| Resource | Owner | Admin | Granted Member | Ungranted Member | Foreign Workspace |
|---|---|---|---|---|---|
| Workspace settings | Allow | Allow (non-billing) | Deny | Deny | Deny |
| Billing | Allow | Deny | Deny | Deny | Deny |
| Domain (settings/DNS) | Allow | Allow | List granted names only | Deny | Deny |
| Domain grant | Allow | Allow | If granted (mail) | Deny | Deny |
| Mailbox | Allow | Allow | If granted | Deny | Deny |
| Message / thread / attachment / draft | Allow | Allow | If mailbox granted | Deny | Deny |
| Send / reply / scheduled | Allow | Allow | If SEND/grant | Deny | Deny |
| Contacts | Allow | Allow | Allow (workspace) | Allow (workspace) | Deny |
| Suppressions | Allow | Allow | Deny mutate; no full list | Deny | Deny |
| Delivery events | Allow | Allow | Granted domains only | Deny (empty) | Deny |
| API keys | Allow | Allow | Deny | Deny | Deny |
| Webhooks | Allow | Allow | Deny | Deny | Deny |
| Newsletter | Allow | Allow | Scoped by workspace settings role | Deny | Deny |
| Presence | Allow | Allow | Granted mailbox thread | Deny | Deny |
| Audit log | Allow | Allow | Deny | Deny | Deny |
| Team invite / role / remove | Allow | Members only (not admins/owner) | Deny | Deny | Deny |
| Client group object | Allow | Allow | Deny | Deny | Deny |
