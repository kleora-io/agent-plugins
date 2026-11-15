# `@kleora-io/mcp`

An MCP server that lets an LLM agent — Claude Code, Codex, or anything else
that speaks the Model Context Protocol — manage a Kleora account **as the
person who authorised it**. It is a client of the management API over HTTPS:
no database connection, no service credential, no capability the API does not
already expose.

```bash
npx -y @kleora-io/mcp
```

Claude Code:

```bash
claude mcp add kleora -- npx -y @kleora-io/mcp
```

Node 20 or newer. For Claude Code there is also a plugin that carries this
server together with skills on using it well — see
[`kleora-io/agent-plugins`](https://github.com/kleora-io/agent-plugins).

## The credential

The first tool call on a profile with no stored credential returns a
verification URL and a short code instead of a result — not an error. Open
the URL, sign in (as yourself, on the issuer's hosted pages), enter the code
and approve. The *retried* tool call then succeeds as you. This is
[RFC 8628](https://www.rfc-editor.org/rfc/rfc8628), the device authorization
grant — the same shape as `gh auth login` or `docker login`.

What you are authorising is a **named, revocable** authorization: it shows up
next to your other sessions in the console, and revoking it there makes the
next tool call re-authorise rather than silently fail or silently keep
working. The sign-in instructions carry a `reason` — `no_credential`,
`refresh_rejected` (the stored sign-in was revoked, expired or refused) or
`signed_out` (removed while the server was running, by `--logout` for
instance) — and a `message` saying the same. A logout from another process,
or a `401` from the API, takes effect at the very next call, so you can sign
out and sign back in as somebody else. The server never holds more permission than you do — there is no
service account and no elevation path.

The refresh token this produces is stored in your OS keychain, or in a
`0600` file under `~/.kleora-mcp` when there is no keychain available.
Never in an environment variable, never on a command line.

## Configure a host

Configuration is the API base URL and a profile name, and both have working
defaults — nothing is required:

```json
{
  "mcpServers": {
    "kleora": {
      "command": "npx",
      "args": ["-y", "@kleora-io/mcp"]
    }
  }
}
```

That is a Claude Desktop / Claude Code style `mcpServers` block (Cursor and
other hosts use the same shape); the exact file it goes in depends on the
host. Flags go after the package name, for example
`"args": ["-y", "@kleora-io/mcp", "--read-only", "--profile=client-acme"]`.

The issuer the device grant runs against is asked of the API itself:
`GET {base-url}/api/v1/platform` answers anonymously with the deployment's
own issuer (`{"issuer": "https://id.kleora.eu"}` for the hosted platform). Nothing is
derived from the base URL's hostname — the hosted API and its issuers are on
different domains. `--issuer` overrides it for a topology the API cannot
describe, and then no request is made.

### Flags and environment variables

Every flag has a `KLEORA_MCP_<NAME>` environment variable equivalent; a
flag wins when both are set.

| Flag | Env var | Default | Meaning |
| --- | --- | --- | --- |
| `--base-url` | `KLEORA_MCP_BASE_URL` | `https://api.kleora.io` | The management API's origin. |
| `--issuer` | `KLEORA_MCP_ISSUER` | asked of the API (`/api/v1/platform`) | Where the device grant runs. |
| `--client-id` | `KLEORA_MCP_CLIENT_ID` | `kleora-mcp` | The OAuth client Kleora registers for this server. |
| `--profile` | `KLEORA_MCP_PROFILE` | `default` | Which stored credential to use — run two profiles for two accounts. |
| `--read-only` | `KLEORA_MCP_READ_ONLY=true` | off | Drops every non-read tool from the list entirely, not merely from what is usable. |
| `--toolsets` | `KLEORA_MCP_TOOLSETS` | all six built ones | Comma-separated: `core,users,tenants,access,clients,audit`. |

None of these ever carries a credential — see "The credential" above for
where that actually lives.

## The tool surface

One tool per management API operation, named `kleora_<resource>_<verb>`, grouped into six
toolsets that are **all on by default**:

| Toolset | Covers |
| --- | --- |
| `core` | `whoami`, the account, Apps, Environments, usage |
| `users` | Users, their sessions, MFA factors, export, password and email actions |
| `tenants` | Tenants, members, invitations |
| `access` | Roles, permissions |
| `clients` | OAuth clients, API keys |
| `audit` | Audit queries at the account, environment and tenant scopes |

Branding, email templates, settings, signing keys and environment promotion
are not in this build; do those in the console.

Every result is the management API's own response body, decorated with
`_environment: { id, kind, app_slug }` when the result names an
`environment_id` — so an approval dialog or a transcript shows exactly what
was touched, in a session that might span sandbox and production both.
Cursor pagination passes straight through: a list tool takes and returns a
cursor and makes exactly one HTTP request, never a hidden loop over a
collection. Errors are the API's own RFC 9457 problem document, `type`,
`title`, `detail` and `status` included, so an agent that gets `403
insufficient-scope` can tell you what to ask for.

### Environments are never implicit

Every environment-scoped tool takes an explicit `environment_id`. There is no
default and nothing is remembered between calls — the parameter is `required`
in the tool's own schema, generated from the operation's OpenAPI path
parameters, so a call that omits it fails schema validation before any
network request is made.

### Destructive tools, and secrets

Tools that are irreversible, wide in blast radius, or that reach a human
inbox carry MCP's `destructiveHint` annotation, so a host can prompt for
exactly those. `--read-only` removes every non-read tool from the list
outright.

`kleora_api_key_create`, `kleora_api_key_rotate`,
`kleora_client_rotate_secret` and `kleora_client_create` mint a
credential that the management API shows exactly once. By default they
succeed and return the id, prefix and metadata with the secret withheld and
a note saying so; pass `return_secret: true` on that one call to have the
secret returned.

### Signing out

```bash
npx -y @kleora-io/mcp --logout --profile=…
```

Revokes the profile's refresh token at the issuer (RFC 7009, so the whole
family goes and one `refresh_token.revoked` audit event is written) and then
deletes the stored credential — **the delete happens even if the revocation
fails**, because a token nobody could revoke is still a token that must not
stay on disk. It says which of the two happened; when the revocation did not,
it says the grant may still be live and to revoke it in the console.

It holds the profile's credential lock while it does this, the same lock every
refresh takes, so a running server that is refreshing at that moment cannot
write a new token back after the delete.

This is what the plugin's `/kleora:logout` runs, and it is the reason an
uninstall leaves no live credential behind.

## Development

This package lives in
[`kleora-io/agent-plugins`](https://github.com/kleora-io/agent-plugins) and is
published from there. From the repository root:

```bash
pnpm install
pnpm --filter @kleora-io/mcp build      # dist/index.js
pnpm --filter @kleora-io/mcp lint
pnpm --filter @kleora-io/mcp typecheck
pnpm --filter @kleora-io/mcp test
pnpm generate:tools                     # refetch the deployed OpenAPI document and regenerate
pnpm plugin-server                      # rebuild the Claude Code plugin's bundled copy
```

To try a local build, point a host at it with `"command": "node"` and
`"args": ["<checkout>/packages/mcp/dist/index.js", "--base-url=<your API>", "--profile=dev"]`.

## Licence

[Apache License, Version 2.0](./LICENSE) — the full text is in this package, so
it travels with whatever you install. Apache-2.0 rather than a shorter
permissive licence because of the explicit patent grant in section 3, which is the
term a legal review of a vendor SDK asks about.

There is no `NOTICE` file, here or in any other Kleora package. The hosted
Kleora service this server talks to is not covered by this licence; it is
proprietary.
