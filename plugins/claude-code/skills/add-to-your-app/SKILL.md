---
name: add-to-your-app
description: Wire Kleora into an existing application — choose the right SDK for the stack, get the issuer URL and client id from the account, register the callback, and verify tokens on the backend. Use when the user says "add login to this app", "integrate Kleora", "protect this API", "verify the access token", or is debugging a first sign-in that redirects but never comes back.
---

# Adding Kleora to an application you already have

Two values configure every integration, and both come from the account rather
than from guesswork:

- the **issuer**, read from the environment (`kleora_environment_read` →
  `issuer`);
- the **client id**, read from the client (`kleora_clients_list` → the
  `client_id` field of the response, not the row's UUID).

Get them with the tools, in the environment you are actually targeting, and
paste what the API returned. Do not reconstruct either by hand.

## The issuer is a URL, not a hostname

Every SDK takes the issuer exactly as Kleora reports it: scheme included, no
trailing slash, sandbox and production differing in the host. A bare hostname
is not an issuer, and neither is the management API's base URL — those are two
different hosts with two different jobs:

- the **issuer** is where sign-in, token exchange, discovery and the key set
  live, and it is what an `iss` claim is checked against;
- the **management API base URL** is where these tools talk, and it belongs
  only in a server-side management client, never in a browser app's config.

The SDKs classify the issuer by its host and refuse anything inconsistent with
it before a single request goes out, so a mistyped issuer fails loudly at
start-up rather than as a puzzling 401 later.

## Pick the package by where the code runs

| The code is | Package | It gives you |
| --- | --- | --- |
| A browser SPA (any framework) | `@kleora-io/browser` | `createKleora({ issuer, clientId, redirectUri })`, `loginWithRedirect()`, `handleRedirectCallback()`, `getAccessToken()`, `getUser()`, `logout()` |
| A Nuxt 4 app | `@kleora-io/nuxt` | the module over the browser SDK: `useKleora()`, `useKleoraUser()`, an `auth: true` page middleware, `$kleoraApi`, and a ready-made `/auth/callback` route |
| A Node backend (Express or Fastify) | `@kleora-io/node` | `verifyAccessToken(token, { issuer, audience })`, JWKS caching, `express()` / `fastify()` middleware, `requirePermission()` |
| A Python backend | `kleora` | `verify_access_token(token, issuer=…, audience=…)`, sync and async |
| A Django backend | `django-kleora` | `KleoraAuthentication`, `KleoraAuthMiddleware`, `@requires_permission(...)`, settings-driven |

The console's overview page for an environment renders the quickstart for that
exact environment and client, with the two values already substituted. When a
person is unsure, that page is the shortest correct path and it is worth
sending them to it.

## The callback has to be registered before it can work

The frontend SDKs complete sign-in at a redirect URI, and Kleora will only
deliver a code to a URI that is registered on the client. The Nuxt module adds
`/auth/callback` for you, so the URI to register is `{origin}/auth/callback`;
with the browser SDK it is whatever you passed as `redirectUri`.

Register it with `kleora_client_update`, sending the **whole**
`redirect_uris` list (it is replaced, not merged). In sandbox a
`http://localhost:PORT/...` callback is accepted; in production only `https://`
is, so the production client needs its own entry — the sandbox one will be
refused with a `422` naming `redirect_uris[i]`.

A first sign-in that reaches the login page, authenticates, and then shows an
error instead of coming back is almost always this: the client has no matching
redirect URI. The environment's auto-created "Default" client ships with none
at all.

## Verifying tokens on the backend

The backend does not call Kleora per request. It verifies the access token
offline against the issuer's published key set:

- **`issuer`**: the same string the frontend uses. Exact match against `iss`.
- **`audience`**: the environment's `api_audience`. It is `null` by default —
  set it with `kleora_environment_update` before you tell a backend to
  require it, or verification will refuse every token.
- Claims worth using: `sub`, `tenant`, `tenant_slug`, `roles`, `permissions`,
  `env`. Authorise on `permissions` (`requirePermission('invoices:read')`),
  not on `roles` — role names are a customer's own vocabulary and change.

Failure codes are precise, and two of them are commonly misread:

- `issuer_unavailable` means the key set could not be fetched. That is an
  outage — answer `503`, not `401`, and do not tell the caller their token is
  bad.
- A token from the **other environment of the same App** is refused as
  `unknown_kid`, not `issuer_mismatch`, because the signature is checked before
  the claims and the two environments have different signing keys. If you see
  `unknown_kid` right after a deployment, suspect a sandbox token reaching a
  production backend (or the reverse) before you suspect key rotation.

## Server-to-server calls with an API key

A backend that administers Kleora itself — creating users, reading the audit
log — uses an API key, not a user token. Two rules:

- A `kl_test_` key belongs to one sandbox environment and a `kl_live_` key to
  one production environment. The SDK checks the prefix against the configured
  issuer at construction and refuses a mismatch before any request; Django
  refuses it at start-up. **Never** move a sandbox key into production config
  "just to test" — it cannot work, by construction.
- An API key reaches one environment. Account-level things — apps, account
  members, promotion — are not reachable with one at all, and answer
  `insufficient-scope`. That is not a permission you can add.

Keys go in the process environment or a secret manager. Never in a browser
bundle, never in the repository, never in a tool result you leave in a
transcript.

## What "done" looks like

Before you tell anyone the integration works, do this once, in sandbox:

1. a user exists (`kleora_user_create`, `email_verified: true` for a test
   account, or `send_verification: true` to make them prove the address);
2. the callback is registered on the client you configured;
3. sign in through the app in a browser and come back signed in;
4. the backend accepts the access token and reports the expected `sub`,
   `tenant` and `env: "sandbox"`;
5. a request with no token is refused.

Then, and only then, repeat the client and user steps in production — see the
`sandbox-to-production` skill for what does and does not carry across.
