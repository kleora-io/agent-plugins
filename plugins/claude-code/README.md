# The Kleora plugin

Manage a Kleora account from your coding agent — create an App, register a
client, add users, invite members, define roles, read the audit log — **as
yourself**, with no API key to paste and no configuration file to hand-edit.

The plugin bundles two things:

- **the Kleora MCP server**, one tool per management API operation, and
- **skills**: written guidance for using those tools correctly, drawn from the
  mistakes this product has actually seen people make.

The tools without the skills are a pile of endpoints. An agent that can call
`create_client` still does not know that a browser app takes PKCE and no
secret, that sandbox and production are separate objects whose credentials must
never be crossed, or that the client every new environment ships with has no
redirect URIs and will fail the first sign-in. That is what the skills carry.

## Install

The plugin is published in the public repository
[`kleora-io/agent-plugins`](https://github.com/kleora-io/agent-plugins). Add it
as a plugin marketplace, then install the plugin:

```
/plugin marketplace add kleora-io/agent-plugins
/plugin install kleora@kleora
```

Or from a terminal:

```bash
claude plugin marketplace add kleora-io/agent-plugins
claude plugin install kleora@kleora
```

The same server without the skills, for Claude Code or any other MCP host, is
`@kleora-io/mcp` on npm:

```bash
claude mcp add kleora -- npx -y @kleora-io/mcp
```

You will be asked for the settings in the table below on install; every one of
them has a working default, so accepting them is a valid answer. Nothing you
enter is a credential.

## Sign in

```
/kleora:login
```

The first tool call on an unauthorised profile answers with a URL and a short
code instead of a result. Open the URL, sign in as yourself, check that the
code in the browser matches the one printed, and approve. You will be asked to
re-authenticate even if you are already signed in — approving an agent's access
requires it, so that a stolen browser session cannot mint one.

What that creates is a **named, revocable authorization**, listed beside your
other sessions in the console. Revoke it there and this plugin's next call
starts a fresh sign-in rather than silently working or silently failing. The
refresh token is kept in a `0600` file under `~/.kleora-mcp`, or in your OS
keychain when the optional keychain module is installed alongside the plugin —
never in an environment variable, never on a command line, never in your
project. `/kleora:logout` tells you which of the two it used.

The plugin never holds more permission than you do. There is no service
account and no elevation path: a call you could not make in the console fails
here too, and that is the design working.

## Configuration

| Setting | Default | What it does |
| --- | --- | --- |
| Management API base URL | `https://api.kleora.io` | Where your account's management API lives. One URL covers both sandbox and production. |
| Credential profile | `default` | Which stored credential to use. Two accounts means two profiles, each authorised separately. |
| Read-only | off | Drops every tool that writes, so the agent can look but not change. A host cannot approve a call that was never offered. |
| Issuer URL (advanced) | asked of the API | Where the browser sign-in happens. Leave it empty: the server asks the management API for it (`/api/v1/platform`). Set it only for a development setup whose API cannot describe it. |

Change them later with `/plugin` → configure, or
`claude plugin install kleora@kleora --config read_only=true`.

## What you get

**Skills** (they load themselves when they are relevant; you can also name one):

| Skill | Covers |
| --- | --- |
| `kleora:using-kleora` | The ground rules: signing in, naming the environment on every call, reading Kleora's errors, shown-once secrets, which calls are destructive |
| `kleora:add-to-your-app` | Adding Kleora to an application you already have: the right SDK, the issuer URL, the callback, verifying tokens on the backend |
| `kleora:apps-and-clients` | Creating an App and getting its clients right per kind — SPA, native, server-side web — redirect URIs, scopes, secrets |
| `kleora:sandbox-to-production` | Going live: what promotion copies, what it never copies, and the checks before the announcement |
| `kleora:members-and-roles` | Tenants, invitations, members, roles and permissions, and why a role change is not instant |
| `kleora:audit-log` | Answering "what happened" — the right scope, the right filter, and what the log deliberately does not record |

**Commands**: `/kleora:login`, `/kleora:logout`.

**Tools**: one per management API operation, named `kleora_<resource>_<verb>`,
grouped into six sets that are all on by default — `core` (whoami, account,
apps, environments, usage), `users`, `tenants`, `access` (roles and
permissions), `clients` (OAuth clients and API keys) and `audit`. Branding,
email templates, per-user settings, signing keys and environment promotion are
not in this build; do those in the console.

Results are the API's own responses, unmodified, with the environment's `kind`
and the App's slug attached so a transcript always shows which environment was
touched. Errors are the API's own problem documents, so a refusal names the
permission you need.

## Versions and updates

The plugin's version is in its manifest and moves with the server it carries;
`claude plugin list` shows what you have installed.

```bash
claude plugin marketplace update kleora   # refresh the catalogue
claude plugin update kleora                    # move to the current version
```

A skill is a plain file inside the plugin, so **fixing bad guidance is a plugin
release, not a change to anything in your project** — you get the corrected
skill on your next update, and nothing you wrote has to change.

To pin a version, add the marketplace from a checkout of the commit you want
instead of from the repository name:

```bash
git clone https://github.com/kleora-io/agent-plugins.git kleora-plugin
git -C kleora-plugin checkout <commit>
claude plugin marketplace add ./kleora-plugin
```

That marketplace stays where you put it until you update it, which is the point
of pinning.

## Uninstall, and leaving nothing behind

**Sign out first** — uninstalling removes the plugin's files and nothing else:

```
/kleora:logout
```

That revokes the authorization at the issuer (so any copy of the stored token
is worthless) and deletes the credential from your keychain or
`~/.kleora-mcp`. Then:

```bash
claude plugin uninstall kleora@kleora
claude plugin marketplace remove kleora   # optional
```

If you uninstalled without signing out: revoke the authorization in the console,
where it is listed beside your sessions, and delete `~/.kleora-mcp` (or the
`kleora-mcp` entry in your keychain).

## Requirements

Node 20 or newer, which the agent's own runtime already satisfies in almost
every installation. The server is a single self-contained file: nothing is
downloaded at run time, nothing is installed into your project, and it works
with no network beyond your own Kleora account.

The one thing it does *not* carry is the optional native keychain module,
which cannot be bundled — it has a different binary per platform. The plugin
declares it as an optional dependency, so where that gets installed the
credential goes into the OS keychain; everywhere else it goes into a `0600`
file under `~/.kleora-mcp`, which is the ordinary case and is checked to be
exactly those permissions.

## Licence

[Apache License, Version 2.0](./LICENSE) — the full text ships with the
plugin. Apache-2.0 rather than a shorter permissive licence because of the
explicit patent grant in section 3, which is the term a legal review of a vendor tool
asks about.

`server/kleora-mcp.mjs` is Kleora's own code under that licence (the server
and `@kleora-io/core`) **plus** the third-party packages compiled into it, because an installed plugin has no
`node_modules` to resolve them from. Those keep their own licences — MIT,
BSD-3-Clause and ISC — and a bundle is a copy, so each one's copyright notice
and permission text travels beside it in
[`server/THIRD-PARTY-NOTICES`](./server/THIRD-PARTY-NOTICES). That file is
generated from the build that produces the bundle, so it cannot describe a
different set of dependencies from the ones inside it.

There is no `NOTICE` file, here or in any other Kleora package, and the
third-party texts deliberately do not live in one: Apache-2.0 section 4(d) would turn
them into an obligation everybody who redistributes this plugin inherits, which
is more than MIT, BSD or ISC asks of us. The hosted Kleora service the plugin
talks to is not covered by this licence; it is proprietary.
