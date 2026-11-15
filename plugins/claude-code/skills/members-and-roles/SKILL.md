---
name: members-and-roles
description: Invite people into a tenant, give them roles, and define the permissions those roles carry — including single- versus multi-tenant environments, why a role change does not take effect immediately, and the rule that makes a role's permission set a replace rather than a merge. Use when the user says "invite a user", "add someone to the team", "give them admin", "create a role", "why can't this user do X", or "the permission change didn't apply".
---

# Members, invitations, roles and permissions

Four nouns, in the order they depend on each other:

- a **Permission** is a string `resource:verb` in one environment;
- a **Role** is a named bundle of permissions, with a slug that goes into
  tokens;
- a **Member** is a user's place in one tenant, holding roles;
- an **Invitation** is a pending membership, sent by email.

Everything here is per environment. Doing it in sandbox does nothing for
production.

## First, find out which kind of environment you are in

Read the environment (`kleora_environment_read`) and look at `tenant_mode`:

- **`single`** — the environment has one hidden `default` tenant. Every user
  becomes a member of it automatically when they are created, `tenants_list`
  will not show it, and creating a tenant is refused. Roles are still assigned
  through that tenant's member endpoints, using the `default_tenant_id` the
  environment reports. This is the right mode for a product with no notion of
  organisations.
- **`multi`** — tenants are real, they appear in lists, a login resolves to one
  of them, and auto-membership stops. Users must be added to tenants
  deliberately.

Switching `multi` → `single` is refused while any tenant other than the default
exists, and when permitted it queues a background backfill; do not switch modes
casually to make a call succeed.

## Adding somebody

**If the user already exists in this environment**, add them directly:
`kleora_member_add` takes `user_id` **or** `email`, plus `roles` (slugs).
An email that is not a user of this environment is refused — that is what an
invitation is for.

**If they do not**, invite them: `kleora_invitation_create` with `email` and
`roles`. That sends mail, which is why the tool is marked destructive — you
cannot un-send it. Ask before you invite anybody.

Invitation rules that catch people:

- One open invitation per tenant and email. An **expired** invitation still
  holds the slot, so creating a fresh one answers `409 invitation-exists`.
  The fix is `kleora_invitation_resend`, not another create — resending
  issues a new token and resets the clock.
- Resends are throttled: one a minute, five an hour, per invitation.
- The link is good for 7 days; accepting it proves the address, so the user's
  email is marked verified at that point.
- An accepted or revoked invitation cannot be resent.

## Roles

Create with `kleora_role_create` (app-scoped: assignable in every tenant of
the environment) or `kleora_tenant_role_create` (assignable only inside that
tenant).

- The **slug is immutable** — it is what tokens carry. `name` and
  `description` are editable.
- Slugs collide across scopes on purpose: an app-scoped slug blocks the same
  slug in every tenant, and a tenant-scoped one blocks creating an app-scoped
  role with that slug. The refusal is `role-slug-conflict`.
- A member may hold any app-scoped role and any tenant-scoped role **of their
  own tenant**; anything else is `role-not-assignable`.

### `kleora_role_permissions_set` replaces — it does not merge

This is the single most dangerous ordinary call in this surface, and it is
marked destructive for exactly that reason. It writes the permission list you
send and drops everything else the role had.

Always: read the role first (`kleora_role_read`), show the person the current
list, send **current + additions**. "Add `invoices:write` to editor" is a
read-then-write, never a one-line write.

`kleora_member_update`'s `roles` behaves the same way — it replaces the
member's full role set.

## Permissions

`kleora_permission_create` takes a `name` shaped `resource:verb`
(lower-case, digits, `_` and `-`). Kleora reserves its own management
namespace — `users`, `tenants`, `members`, `invitations`, `roles`,
`permissions`, `sessions`, `audit`, `settings`, `branding`, `clients`,
`api_keys`, `signing_keys`, `email_templates`, `webhooks`, `billing`,
`account`, `apps` — and a customer permission in any of those is refused. Name
application permissions after the application's own resources
(`invoices:read`, `reports:write`).

Deleting a permission removes it from every role that carried it; deleting a
role removes it from every member and open invitation. Both are recorded with
the number of rows affected.

## Why a change "did not take effect"

Roles and permissions are resolved **when a token is issued**, not when a
request is made. So a change reaches a signed-in user:

- at their next refresh, or
- within the environment's access-token lifetime at the latest.

If it has to be immediate — a role taken away in an incident — revoke the
user's sessions (`kleora_user_sessions_revoke_all`). That signs them out
everywhere, so say so before doing it. Kleora keeps no revocation list for
access tokens already issued; that is the trade being made.

Also worth checking before assuming a bug: a token carries at most 200
permissions. Reserved ones are always kept; a customer permission can be
dropped from the end of a very long list, and the token then carries
`permissions_truncated: true`.

## Two guards that will refuse you, correctly

- **Tenant administrators cannot grant themselves more than they hold.** A
  caller acting as a tenant member may only put permissions into a role that
  they already hold, and may only edit tenant-scoped roles whose current
  permissions are a subset of their own. Violations answer
  `privilege-escalation`. Console users and API keys are exempt.
- **The account's own tenant must keep an owner.** Removing, suspending or
  re-roling the last active `owner` is refused (`last-owner`), and adding or
  removing the `owner` role there requires the caller to be an active owner of
  that tenant themselves (`owner-required`).

Neither is a bug to work around. Both are refusals to relay, with the reason.

## Suspend versus remove

`kleora_member_update` with `status: "suspended"` keeps the row and the
roles, and stops the person selecting that tenant at login.
`kleora_member_remove` deletes the membership and revokes their sessions
bound to that tenant. Suspension is reversible and is almost always the right
first move.
