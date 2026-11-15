---
name: sandbox-to-production
description: Take an integration from sandbox to production safely — what promotion copies and, more importantly, what it never copies, plus the key, issuer and redirect-URI differences between the two environments. Use when the user says "go live", "promote to production", "ship this", "set up the production environment", or asks why something that worked in sandbox does not work in production.
---

# Sandbox to production

Every App has exactly two environments, created together and structurally
identical. Sandbox is not a toy: it has its own users, its own signing keys and
its own issuer. What it is not is a copy of production, and it never becomes
one.

## The differences, all of them

| | Sandbox | Production |
| --- | --- | --- |
| Issuer host | first label ends in `-sandbox` (`acme-sandbox.kleora.eu`) | does not (`acme.kleora.eu`) |
| API key prefix | `kl_test_` | `kl_live_` |
| `env` claim in tokens | `sandbox` | `production` |
| Redirect URIs | `https://`, plus `http://localhost` and `http://127.0.0.1` on any port | `https://` only |
| Counted towards usage | never | yes |
| Promotion | the source | the target |

A `kl_test_` key reaches only its sandbox environment and a `kl_live_` key only
its production one — not by a permission check that could be widened, but
because the key belongs to one environment row. A key or a client id pasted
across that line cannot work, and the SDKs refuse the pairing at start-up
rather than at 3am.

## What promotion actually does

Promotion copies **configuration** from a sandbox environment to its production
sibling, in one transaction, and returns a diff:

- environment settings (tenant mode, self-registration, locales, token and
  session TTLs, password policy, MFA policy, API audience);
- branding, with URLs pointing at the sandbox issuer rewritten to production;
- permissions, matched by name — created or updated, never deleted;
- **app-scoped** roles, matched by slug, with their permission sets;
- email templates, matched by kind and locale.

## What promotion never copies — this is the part that surprises people

Users. Tenants. Members. Invitations. **Clients.** API keys. Signing keys.
Sessions. Audit events. Tenant-scoped roles.

So going live is not "promote and done". Production needs, done separately:

1. **Its own client**, with `https://` redirect URIs — the sandbox client id is
   not valid there and never will be.
2. **Its own API keys** (`kl_live_`), with the scopes that backend actually
   needs.
3. **Its own users** — real ones, signing up or invited. Nothing you created in
   sandbox exists in production.
4. Application config pointing at the **production issuer**.

A useful way to say it to a person: promotion moves *the rules*, never *the
people or the credentials*.

## Doing it

Promotion is addressed at the **sandbox** environment (calling it on a
production id is refused as `not-sandbox`), takes `dry_run`, and reports the
same diff either way. Run the dry run first and read it out: it is the only
preview anybody gets, and it also tells you whether the caller may apply it —
promotion needs `settings:write` at account level *and* the write permission
for each non-empty section of the diff, so a dry run that answers
`insufficient-permission` naming `branding:write` has saved you a half-applied
mental model.

**This plugin does not expose a promotion tool.** The promotion toolset is
designed but not built into this build of the server, along with branding,
email templates, per-user settings and signing keys. Do not improvise an HTTP
call: send the person to the console's environment page, and use this skill to
tell them what the diff will and will not contain before they press it.

`kleora_environment_update` *is* available, so a single setting can be
changed directly on production when that is what is wanted — and being
explicit about which environment you are writing to matters more here than
anywhere else.

## Before going live: a checklist worth reading out

- The production client exists, its `redirect_uris` are the real `https://`
  callbacks, and `allowed_scopes` matches what the app asks for.
- `initiate_login_uri` is set on the default client if the product links people
  to a bare login page.
- The environment's `api_audience` is set if a backend verifies `aud`.
- MFA policy, password policy and session TTLs are what production should have
  — check them on the production environment rather than assuming the sandbox
  values were promoted (they are, if you promote; they are not, if you did not).
- API keys used by production are `kl_live_` and were created in the production
  environment.
- One real sign-in has been done through the production issuer, end to end,
  before the announcement.
- Nobody has copied a `kl_test_` key, a sandbox client id or a sandbox issuer
  into production configuration. Grep for `-sandbox.` and `kl_test_` in the
  deployment config; both are easy to spot and both are fatal.

## Symptoms and their real causes

| Symptom in production | Usual cause |
| --- | --- |
| `422` on a redirect URI that worked in sandbox | `http://localhost` is sandbox-only. |
| Token refused as `unknown_kid` | A sandbox token reaching a production backend, or the reverse — different signing keys. |
| SDK throws about a mismatched environment at start-up | A `kl_test_` key with a production issuer, or a sandbox issuer with production config. |
| Sign-in works, the app never receives the user | Production client's redirect URI is missing or does not match exactly. |
| A promoted role grants nobody anything | The role was created on production; the memberships that would hold it were not — those are per environment and are never copied. A production member who *already* holds a role of that slug does pick up its new permission set at their next token. |
