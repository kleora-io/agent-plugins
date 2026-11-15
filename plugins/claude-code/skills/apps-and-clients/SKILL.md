---
name: apps-and-clients
description: Create a Kleora App and get its OAuth clients right for the kind of application being connected — SPA, native, or server-side web app — including redirect URIs, the default client that starts with none, secrets that are shown once, and scopes. Use when the user says "create an app in Kleora", "add a client", "register a redirect URI", "rotate the client secret", or a sign-in fails with invalid_redirect_uri or invalid_client.
---

# Apps and clients

## What creating an App gives you

`kleora_app_create` takes a `name` and an optional `slug`, and provisions, in
one transaction:

- the App;
- **two environments, sandbox and production**, each with its own issuer URL;
- per environment: a `default` tenant, one `spa` client named "Default"
  (`is_default: true`), signing keys, default branding and settings, the
  reserved permissions, and the default email templates.

The **slug is permanent**. It becomes two public hostnames, so it cannot be
renamed later without invalidating every token and every cached key set already
issued — the API refuses the rename rather than half-doing it. Omit `slug` and
one is derived from the name (lower-cased, punctuation collapsed to `-`,
truncated to 40 characters); a handful of labels are reserved and refused.
Whether a slug is taken is already public — it is a DNS name — so a 409 there
tells nobody anything they could not look up. Pick the slug deliberately, and
tell the person it is forever.

`name` is free text and can be changed at any time.

## The trap: the default client has no redirect URIs

Every new environment gets a client named "Default", and it is created with an
**empty `redirect_uris` list**. Point an SDK at it and the first sign-in fails —
the browser reaches the login page, authenticates, and then has nowhere to be
sent back to.

So the order of work is always:

1. `kleora_clients_list` with `is_default: true` for the environment — that
   returns the one client the hosted pages fall back to;
2. `kleora_client_update` to add the application's callback URL to
   `redirect_uris`;
3. only then wire up the SDK.

`redirect_uris` is replaced whole by an update (it is a merge patch, and there
is no add-one-URI operation). **Read the current list, append, send the whole
list back.** `[]` is valid and means "none".

## Pick the client kind by where the code runs

| Where the app runs | `kind` | Secret | Flow |
| --- | --- | --- | --- |
| A browser SPA — React, Vue, Nuxt, anything served to a user's browser | `spa` | **none, ever** | authorization code + PKCE |
| A mobile or desktop app | `native` | **none, ever** | authorization code + PKCE |
| A server-side web app that can keep a secret | `web` | one, shown once at creation | authorization code + client secret |

The model refuses a secret on a `spa` or `native` client, and it is right to: a
secret shipped to a browser or an app store is not a secret. If somebody asks
for "the client secret" for a single-page app, the answer is that there isn't
one and none is needed — PKCE is what proves the exchange came from the same
client that started it.

Switching an existing client's `kind` **away** from `web` clears its secret in
the same write; switching **to** `web` does not mint one — call
`kleora_client_rotate_secret` afterwards.

## Creating a client

`kleora_client_create` takes `name` and `kind`, plus optional
`redirect_uris`, `post_logout_redirect_uris`, `initiate_login_uri` and
`allowed_scopes`.

Things the API refuses, so do not send them:

- `client_id`, `client_secret`, `has_secret` — the identifier is minted
  server-side and is not yours to choose;
- `is_default` on creation — a new client is never silently the one the hosted
  pages fall back to. Promote it afterwards with an update, which is one
  deliberate change and one audit event.

**Two different values are called `client_id`, and confusing them is a 404.**
The `client_id` in a tool's path arguments is the client row's **UUID**; the
`client_id` in the response body is the **OAuth identifier** (32 URL-safe
characters) that goes into application config. Never pass the OAuth identifier
where a path wants the row id.

`device_grant_enabled` defaults to false and should stay false unless you are
deliberately building a device- or CLI-style sign-in for that client.

### Redirect URI rules

Absolute, no fragment, no wildcard, no `user@` component, no whitespace or
`;`. Then one rule that catches everybody:

- **sandbox** additionally accepts `http://localhost` and `http://127.0.0.1`
  with any port and path;
- **production accepts `https://` only** — a `http://localhost` callback that
  worked in sandbox is a `422` in production, naming `redirect_uris[i]`.

`initiate_login_uri` is where a hosted page sends a browser that arrived with
nowhere to go. It is **not** a redirect URI and must never be listed as one: a
browser landing on a callback URL with no authorization response in it is an
application showing an error for a sign-in that actually worked.

### Scopes

`allowed_scopes` must be a subset of `openid`, `profile`, `email`,
`offline_access`, must not repeat itself, and **must contain `openid`** — every
flow here is OIDC and a client without it gets no ID token. Dropping
`offline_access` is the supported way to stop a client being able to obtain a
refresh token; that is a decision, not a default.

## Secrets, and rotation without downtime

Creating a `web` client returns `client_secret` once, in the creation response.
It is stored as a hash and is never readable again — not in a list, not in a
detail read, not in the audit log.

`kleora_client_rotate_secret` mints a new one and **the old secret stops
working immediately**. There is no overlap window. So "rotate the secret on the
live app" is the wrong shape of change; the way to move without downtime is:

1. create a second `web` client;
2. deploy it alongside, move traffic;
3. delete the first.

Deleting a client removes its authorization codes, in-flight requests and
refresh tokens. It leaves sessions alone — a session belongs to the
environment, not the client — so people stay signed in at the hosted pages,
but nothing minted through the deleted client can be refreshed again.

## The default client

Exactly one client per environment carries `is_default`, and the hosted pages
depend on there always being one. The flag **moves**: set it true on another
client and the previous holder is demoted in the same write. You cannot set it
false, and you cannot delete the current default — do the swap first. Both
refusals come back as `409 client-default` with the swap named in `detail`.

## A working order for a new integration

1. `kleora_app_create` — name, and a slug you have thought about.
2. `kleora_app_environments_list` — note both ids and which is which.
3. Work in **sandbox** first.
4. `kleora_clients_list` with `is_default: true`, or create a client of the
   right kind for the application.
5. Add the callback URL to `redirect_uris`.
6. Read the environment's `issuer` (`kleora_environment_read`) and the
   client's OAuth `client_id`. Those two values are what the SDK needs — see
   the `add-to-your-app` skill for the rest.
7. Create a test user (`kleora_user_create` with `email_verified: true` in
   sandbox) and sign in once, end to end, before touching production.
