# agent-plugins

Kleora's agent plugins and skills: manage your Kleora account from Claude Code
and other MCP hosts, as yourself.

| Path | What it is |
| --- | --- |
| [`plugins/claude-code`](./plugins/claude-code) | The Claude Code plugin: the MCP server, bundled, plus skills and the `/kleora:login` and `/kleora:logout` commands |
| [`packages/mcp`](./packages/mcp) | [`@kleora-io/mcp`](https://www.npmjs.com/package/@kleora-io/mcp), the same MCP server for any host: a local stdio server that signs in with the device grant |
| [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json) | The marketplace this repository is, offering the plugin |

## Install

In Claude Code:

```
/plugin marketplace add kleora-io/agent-plugins
/plugin install kleora@kleora
```

Or from a terminal:

```bash
claude plugin marketplace add kleora-io/agent-plugins
claude plugin install kleora@kleora
```

Then `/kleora:login`. The plugin's [README](./plugins/claude-code/README.md)
covers configuration, signing out and uninstalling.

The server alone, for Claude Code or any other MCP host:

```bash
claude mcp add kleora -- npx -y @kleora-io/mcp
```

## Development

Node 22 and pnpm (the version is pinned in `package.json`).

```bash
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Three things are generated and committed, and CI fails when any of them is
stale:

- **The tool definitions.** `pnpm generate:tools` fetches the management API's
  OpenAPI document from `https://api.kleora.io/api/v1/openapi.json` into
  `openapi/management-v1.json` and regenerates
  `packages/mcp/src/generated/operations.ts` from it. Which operations become
  tools, and what they are called, is the hand-written
  `packages/mcp/src/tools/catalog.json`.
- **The plugin's server bundle.** `pnpm plugin-server` builds
  `plugins/claude-code/server/kleora-mcp.mjs` (an installed plugin has no
  `node_modules`, so it carries the whole server) and the
  `THIRD-PARTY-NOTICES` beside it. Run it after any change to
  `packages/mcp/src` or to its dependencies.
- **One version.** The plugin's version is the server's version.
  `pnpm check:versions` checks that `packages/mcp/package.json`,
  `packages/mcp/src/version.ts`, `plugins/claude-code/.claude-plugin/plugin.json`
  and `plugins/claude-code/package.json` agree.

## Releasing

`@kleora-io/mcp` is published to npm by `.github/workflows/release.yml`, run by
hand from the Actions tab, through npm trusted publishing: no token exists
anywhere. It publishes whatever version `packages/mcp/package.json` names, and
skips a version already on npm. The plugin needs no publishing: installing it
reads this repository's `main` branch.

## Licence

[Apache License, Version 2.0](./LICENSE).
